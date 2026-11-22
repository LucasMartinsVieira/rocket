import type {
  CatalogAdapter,
  CatalogResult,
  CatalogSearch,
  CatalogSearchPage,
} from "../catalog";

type Row = Record<string, unknown>;
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

  async search({
    query,
    cursor,
    signal,
  }: CatalogSearch): Promise<CatalogSearchPage> {
    const page = cursor === undefined ? 1 : Number(cursor);
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(page * pageSize) ||
      page < 1
    )
      throw new Error("Invalid book search page.");
    const params = new URLSearchParams({
      q: isbnQuery(query),
      page: String(page),
      limit: String(pageSize),
      fields: "key,title,author_name,first_publish_year,cover_i",
    });
    const data = await this.request(
      `https://openlibrary.org/search.json?${params}`,
      signal,
    );
    if (!Array.isArray(data.docs))
      throw new Error("Open Library returned an invalid search response.");
    const results = data.docs.map((row) => this.openLibraryResult(object(row)));
    const parsed = Number(data.numFound ?? data.num_found ?? NaN);
    const total =
      Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
    return {
      results,
      total,
      nextCursor:
        results.length && total !== undefined && page * pageSize < total
          ? String(page + 1)
          : undefined,
    };
  }

  async details(
    result: CatalogResult,
    signal?: AbortSignal,
  ): Promise<CatalogResult> {
    const match = /^openlibrary:(OL\d+W)$/.exec(result.id);
    if (result.adapterId !== this.id || !match)
      throw new Error("Invalid book provider ID.");
    const data = await this.request(
      `https://openlibrary.org/works/${match[1]}.json`,
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

  private async request(url: string, signal?: AbortSignal): Promise<Row> {
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort);
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 429)
        throw new Error("Open Library request limit reached. Try again later.");
      if (!response.ok)
        throw new Error(
          "Open Library is unavailable. Try again or enter manually.",
        );
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("Open Library returned an invalid response.");
      return data as Row;
    } catch (error) {
      if (signal?.aborted) throw new Error("Lookup cancelled.");
      if (controller.signal.aborted)
        throw new Error("Open Library timed out. Try again or enter manually.");
      if (error instanceof TypeError)
        throw new Error(
          "Could not reach Open Library. Check your connection or enter manually.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
