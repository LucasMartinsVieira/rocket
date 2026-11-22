import type {
  CatalogAdapter,
  CatalogResult,
  CatalogSearch,
  CatalogSearchPage,
} from "../catalog";

type Row = Record<string, unknown>;
type BookSource = "openlibrary" | "google";
const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const names = (value: unknown) =>
  Array.isArray(value) ? value.map(text).filter(Boolean).join(", ") : "";
const year = (value: unknown) => {
  const n = Number(String(value ?? "").match(/\b\d{4}\b/)?.[0]);
  return n > 0 && n <= 9999 ? n : null;
};

const cover = (id: unknown) =>
  typeof id === "number" && id > 0
    ? `https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`
    : "";

function isbnQuery(query: string) {
  const compact = query.replace(/^isbn\s*:?\s*/i, "").replace(/[\s-]/g, "");
  return /^(?:\d{9}[\dXx]|\d{13})$/.test(compact)
    ? `isbn:${compact.toUpperCase()}`
    : query;
}

const pageSize = 10;

export class BooksAdapter implements CatalogAdapter {
  readonly id = "books";

  constructor(private readonly readKey: () => Promise<string | null>) {}

  async search({
    query,
    cursor,
    signal,
  }: CatalogSearch): Promise<CatalogSearchPage> {
    const { source, page } = this.parseCursor(cursor);
    let primaryFailed = false;
    if (source !== "google") {
      try {
        const primary = await this.searchOpenLibrary(query, page, signal);
        if (primary.results.length || source === "openlibrary") return primary;
      } catch (error) {
        if (signal?.aborted || source === "openlibrary") throw error;
        primaryFailed = true;
      }
    }

    const key = await this.googleKey(signal);
    if (!key) {
      if (primaryFailed)
        throw new Error(
          "Open Library could not complete this search. Retry, enter manually, or save a Google Books API key for fallback.",
        );
      throw new Error(
        source === "google"
          ? "Save your Google Books API key in Provider Integrations first."
          : "No Open Library matches. Save a Google Books API key in Provider Integrations to try the fallback, or enter manually.",
      );
    }
    return this.searchGoogle(query, page, key, signal);
  }

  async details(
    result: CatalogResult,
    signal?: AbortSignal,
  ): Promise<CatalogResult> {
    if (result.adapterId !== this.id)
      throw new Error("Invalid book provider ID.");
    if (result.id.startsWith("google:")) {
      const id = result.id.slice(7);
      if (!/^[\w-]+$/.test(id)) throw new Error("Invalid Google Books ID.");
      const key = await this.googleKey(signal);
      if (!key)
        throw new Error(
          "Save your Google Books API key in Provider Integrations first.",
        );
      return this.googleResult(
        await this.request(
          `https://www.googleapis.com/books/v1/volumes/${id}?${new URLSearchParams({ key })}`,
          "Google Books",
          signal,
        ),
      );
    }
    const match = /^openlibrary:(OL\d+W)$/.exec(result.id);
    if (!match) throw new Error("Invalid book provider ID.");
    const data = await this.request(
      `https://openlibrary.org/works/${match[1]}.json`,
      "Open Library",
      signal,
    );
    return {
      ...result,
      summary: text(data.description) || text(object(data.description).value),
      coverUri:
        result.coverUri ||
        cover(Array.isArray(data.covers) ? data.covers[0] : null),
    };
  }

  private parseCursor(cursor?: string): { source?: BookSource; page: number } {
    if (cursor === undefined) return { page: 1 };
    const match = /^(openlibrary|google):([1-9]\d*)$/.exec(cursor);
    const page = Number(match?.[2]);
    if (!match || !Number.isSafeInteger(page * pageSize) || page < 2)
      throw new Error("Invalid book search page.");
    return { source: match[1] as BookSource, page };
  }

  private async googleKey(signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    const key = await this.readKey().catch(() => null);
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    return key?.trim() ?? "";
  }

  private async searchOpenLibrary(
    query: string,
    page: number,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      q: isbnQuery(query),
      page: String(page),
      limit: String(pageSize),
      fields: "key,title,author_name,first_publish_year,cover_i",
    });
    const data = await this.request(
      `https://openlibrary.org/search.json?${params}`,
      "Open Library",
      signal,
    );
    if (!Array.isArray(data.docs))
      throw new Error("Open Library returned an invalid search response.");
    return this.searchPage(
      data.docs.map((row) => this.openLibraryResult(object(row))),
      data.numFound ?? data.num_found,
      "openlibrary",
      page,
    );
  }

  private async searchGoogle(
    query: string,
    page: number,
    key: string,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      q: isbnQuery(query),
      startIndex: String((page - 1) * pageSize),
      maxResults: String(pageSize),
      printType: "books",
      key,
    });
    const data = await this.request(
      `https://www.googleapis.com/books/v1/volumes?${params}`,
      "Google Books",
      signal,
    );
    if (data.items !== undefined && !Array.isArray(data.items))
      throw new Error("Google Books returned an invalid search response.");
    return this.searchPage(
      ((data.items as unknown[] | undefined) ?? []).map((row) =>
        this.googleResult(object(row)),
      ),
      data.totalItems,
      "google",
      page,
    );
  }

  private searchPage(
    results: CatalogResult[],
    count: unknown,
    source: BookSource,
    page: number,
  ): CatalogSearchPage {
    const parsed = Number(count ?? NaN);
    const total =
      Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
    return {
      results,
      total,
      nextCursor:
        results.length && total !== undefined && page * pageSize < total
          ? `${source}:${page + 1}`
          : undefined,
    };
  }

  private openLibraryResult(row: Row): CatalogResult {
    const id = text(row.key).replace(/^\/works\//, "");
    if (!/^OL\d+W$/.test(id) || !text(row.title))
      throw new Error("Open Library returned an invalid book.");
    return {
      id: `openlibrary:${id}`,
      adapterId: this.id,
      provider: "Open Library",
      sourceUrl: `https://openlibrary.org/works/${id}`,
      type: "Book",
      title: text(row.title),
      creator: names(row.author_name),
      releaseYear: year(row.first_publish_year),
      coverUri: cover(row.cover_i),
      summary: "",
    };
  }

  private googleResult(row: Row): CatalogResult {
    const info = object(row.volumeInfo);
    const id = text(row.id);
    if (!/^[\w-]+$/.test(id) || !text(info.title))
      throw new Error("Google Books returned an invalid book.");
    const image = text(object(info.imageLinks).thumbnail).replace(
      /^http:\/\//,
      "https://",
    );
    return {
      id: `google:${id}`,
      adapterId: this.id,
      provider: "Google Books",
      sourceUrl: `https://books.google.com/books?id=${encodeURIComponent(id)}`,
      type: "Book",
      title: text(info.title),
      creator: names(info.authors),
      duration:
        Number.isSafeInteger(info.pageCount) && Number(info.pageCount) > 0
          ? Number(info.pageCount)
          : null,
      releaseYear: year(info.publishedDate),
      coverUri: /^https:\/\//.test(image) ? image : "",
      summary: text(info.description)
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim(),
    };
  }

  private async request(
    url: string,
    source: string,
    signal?: AbortSignal,
  ): Promise<Row> {
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort);
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 429)
        throw new Error(`${source} request limit reached. Try again later.`);
      if (response.status === 401 || response.status === 403)
        throw new Error(
          `${source} denied this request. Check your Google Books key and quota in Provider Integrations.`,
        );
      if (!response.ok)
        throw new Error(
          `${source} is unavailable. Try again or enter manually.`,
        );
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error(`${source} returned an invalid response.`);
      return data as Row;
    } catch (error) {
      if (signal?.aborted) throw new Error("Lookup cancelled.");
      if (controller.signal.aborted)
        throw new Error(`${source} timed out. Try again or enter manually.`);
      if (error instanceof TypeError)
        throw new Error(
          `Could not reach ${source}. Check your connection or enter manually.`,
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
