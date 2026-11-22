import type {
  AdapterCatalogResult,
  CatalogAdapter,
  CatalogResult,
  CatalogSearch,
  CatalogSearchPage,
} from "../catalog";

const pageSize = 10;
const lastPage = 100;
type OmdbRecord = Record<string, unknown>;
const text = (value: unknown) =>
  typeof value === "string" && value !== "N/A" ? value.trim() : "";

export class OmdbAdapter implements CatalogAdapter {
  readonly id = "omdb";

  constructor(private readonly readKey: () => Promise<string | null>) {}

  async search({
    query,
    cursor,
    signal,
  }: CatalogSearch): Promise<CatalogSearchPage> {
    const page = cursor === undefined ? 1 : Number(cursor);
    if (!Number.isInteger(page) || page < 1 || page > lastPage)
      throw new Error("Invalid OMDb page.");
    const key = await this.getKey(signal);
    if (/^tt\d+$/i.test(query.trim())) {
      const row = await this.request(
        { i: query.trim().toLowerCase(), type: "movie", plot: "full" },
        key,
        signal,
      );
      if (Array.isArray(row.Search)) return { results: [], total: 0 };
      return { results: [this.normalize(row)], total: 1 };
    }
    const row = await this.request(
      { s: query.trim(), type: "movie", page: String(page) },
      key,
      signal,
    );
    if (!Array.isArray(row.Search))
      throw new Error("OMDb returned an invalid search response.");
    const results = row.Search.map((item) =>
      this.normalize(item as OmdbRecord),
    );
    const count = Number(row.totalResults ?? NaN);
    const total = Number.isSafeInteger(count) && count >= 0 ? count : undefined;
    const hasMore =
      page < lastPage &&
      results.length > 0 &&
      (total === undefined
        ? results.length === pageSize
        : page * pageSize < total);
    return {
      results,
      total,
      nextCursor: hasMore ? String(page + 1) : undefined,
    };
  }

  async details(
    result: CatalogResult,
    signal?: AbortSignal,
  ): Promise<AdapterCatalogResult> {
    if (result.adapterId !== this.id || !/^tt\d+$/.test(result.id))
      throw new Error("Invalid OMDb movie ID.");
    return this.normalize(
      await this.request(
        { i: result.id, type: "movie", plot: "full" },
        await this.getKey(signal),
        signal,
      ),
    );
  }

  private async getKey(signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    const key = await this.readKey();
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    return key ?? "";
  }

  private normalize(row: OmdbRecord): AdapterCatalogResult {
    if (!row || typeof row !== "object")
      throw new Error("OMDb returned an invalid movie result.");
    const id = text(row.imdbID);
    const title = text(row.Title);
    if (!/^tt\d+$/.test(id) || !title || row.Type !== "movie") {
      throw new Error(
        "OMDb returned an invalid movie result. Try another title.",
      );
    }
    const year = Number(text(row.Year).match(/^\d{4}/)?.[0]);
    const poster = text(row.Poster);
    return {
      id,
      adapterId: this.id,
      title,
      provider: "OMDb API",
      type: "Movie",
      sourceUrl: `https://www.imdb.com/title/${id}/`,
      coverUri: /^https:\/\//i.test(poster) ? poster : "",
      releaseYear: year >= 1 && year <= 9999 ? year : null,
      creator: text(row.Director),
      summary: text(row.Plot),
      duration:
        /^\d+ min$/.test(text(row.Runtime)) &&
        Number.parseInt(text(row.Runtime), 10) > 0
          ? Number.parseInt(text(row.Runtime), 10)
          : null,
    };
  }

  private async request(
    params: Record<string, string>,
    key: string,
    signal?: AbortSignal,
  ): Promise<OmdbRecord> {
    if (!key.trim())
      throw new Error(
        "Save your OMDb API key in Settings → Provider Integrations first.",
      );
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort);
    const timeout = setTimeout(abort, 15000);
    try {
      const query = new URLSearchParams({
        ...params,
        apikey: key.trim(),
        r: "json",
      });
      const response = await fetch(`https://www.omdbapi.com/?${query}`, {
        signal: controller.signal,
      });
      if (response.status === 401)
        throw new Error(
          "OMDb rejected your API key. Update it in Provider Integrations.",
        );
      if (response.status === 429)
        throw new Error("OMDb request limit reached. Try again later.");
      if (!response.ok)
        throw new Error(
          "OMDb is unavailable. Try again later or enter manually.",
        );
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("OMDb returned an invalid response.");
      const row = data as OmdbRecord;
      if (row.Response === "False") {
        const message = text(row.Error);
        if (/not found|no results/i.test(message))
          return { Search: [], totalResults: "0" };
        if (/key|activat/i.test(message))
          throw new Error(
            "OMDb rejected your API key. Check that it is correct and activated.",
          );
        if (/limit/i.test(message))
          throw new Error("OMDb request limit reached. Try again later.");
        throw new Error(
          "OMDb could not complete this query. Try a more specific movie title.",
        );
      }
      return row;
    } catch (error) {
      if (signal?.aborted) throw new Error("Lookup cancelled.");
      if (controller.signal.aborted)
        throw new Error("OMDb timed out. Try again or enter manually.");
      if (error instanceof TypeError)
        throw new Error(
          "Could not reach OMDb. Check your connection or enter manually.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
