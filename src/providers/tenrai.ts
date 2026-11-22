import type {
  AdapterCatalogResult,
  CatalogAdapter,
  CatalogResult,
  CatalogSearch,
  CatalogSearchPage,
} from "../catalog";

type Kind = "anime" | "manga";
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const names = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => text(row(item).name))
        .filter(Boolean)
        .join(", ")
    : "";

// Anime and Manga share one client so all requests count toward the same limits.
export class TenraiClient {
  private readonly cache = new Map<string, { data: Row; expires: number }>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastStarted = 0;
  private retryAt = 0;

  async request(path: string, signal?: AbortSignal): Promise<Row> {
    const run = async () => {
      if (signal?.aborted) throw new Error("Lookup cancelled.");
      const cached = this.cache.get(path);
      if (cached && cached.expires > Date.now()) return cached.data;
      if (Date.now() < this.retryAt)
        throw new Error(
          `Tenrai request limit reached. Try again in ${Math.ceil((this.retryAt - Date.now()) / 1000)} seconds.`,
        );
      // Serialize requests and stay below both public limits: 4/s and 120/min.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, this.lastStarted + 550 - Date.now())),
      );
      if (signal?.aborted) throw new Error("Lookup cancelled.");
      this.lastStarted = Date.now();
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort);
      const timer = setTimeout(abort, 15000);
      try {
        const response = await fetch(`https://api.tenrai.org/v1/${path}`, {
          signal: controller.signal,
        });
        if (response.status === 429) {
          const raw = response.headers.get("Retry-After");
          const seconds = Number(raw);
          this.retryAt =
            Date.now() +
            (raw && Number.isFinite(seconds)
              ? Math.max(1, seconds) * 1000
              : Math.max(1000, Date.parse(raw ?? "") - Date.now()) || 60000);
          throw new Error(
            "Tenrai request limit reached. Please wait before trying again.",
          );
        }
        if (response.status === 404)
          throw new Error("This title is no longer available on Tenrai.");
        if (!response.ok)
          throw new Error(
            "Tenrai is unavailable. Try again later or enter manually.",
          );
        const data: unknown = await response.json();
        if (
          !data ||
          typeof data !== "object" ||
          Array.isArray(data) ||
          !("data" in data)
        )
          throw new Error("Tenrai returned an invalid response.");
        if (this.cache.size >= 100) this.cache.clear();
        this.cache.set(path, {
          data: data as Row,
          expires: Date.now() + 300000,
        });
        return data as Row;
      } catch (error) {
        if (signal?.aborted) throw new Error("Lookup cancelled.");
        if (controller.signal.aborted)
          throw new Error("Tenrai timed out. Try again or enter manually.");
        if (error instanceof TypeError)
          throw new Error(
            "Could not reach Tenrai. Check your connection or enter manually.",
          );
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    };
    const pending = this.queue.then(run);
    this.queue = pending.catch(() => undefined);
    return pending;
  }
}

export class TenraiAdapter implements CatalogAdapter {
  readonly id: `tenrai-${Kind}`;

  constructor(
    private readonly kind: Kind,
    private readonly client: TenraiClient,
  ) {
    this.id = `tenrai-${kind}`;
  }

  async search({
    query,
    cursor,
    signal,
  }: CatalogSearch): Promise<CatalogSearchPage> {
    if (!query.trim() || query.length > 300)
      throw new Error("Enter a title up to 300 characters for Tenrai lookup.");
    const page = cursor === undefined ? 1 : Number(cursor);
    if (!Number.isSafeInteger(page) || page < 1)
      throw new Error("Invalid Tenrai page.");
    const params = new URLSearchParams({
      q: query.trim(),
      page: String(page),
      limit: "10",
      sfw: "true",
    });
    const data = await this.client.request(`${this.kind}?${params}`, signal);
    if (!Array.isArray(data.data))
      throw new Error("Tenrai returned an invalid search response.");
    const results = data.data.map((item) => this.normalize(item));
    const pagination = row(data.pagination);
    const count = Number(row(pagination.items).total ?? NaN);
    return {
      results,
      total: Number.isSafeInteger(count) && count >= 0 ? count : undefined,
      nextCursor:
        pagination.has_next_page === true &&
        results.length &&
        page < Number.MAX_SAFE_INTEGER
          ? String(page + 1)
          : undefined,
    };
  }

  async details(
    result: CatalogResult,
    signal?: AbortSignal,
  ): Promise<AdapterCatalogResult> {
    const match = /^tenrai:(anime|manga):([1-9]\d*)$/.exec(result.id);
    if (result.adapterId !== this.id || !match || match[1] !== this.kind)
      throw new Error("Invalid Tenrai title ID.");
    const data = await this.client.request(
      `${this.kind}/${match[2]}?sfw=true`,
      signal,
    );
    return this.normalize(data.data);
  }

  private normalize(value: unknown): AdapterCatalogResult {
    const kind = this.kind;
    const data = row(value);
    const id = data.mal_id;
    const title =
      text(data.title) || text(data.title_english) || text(data.title_japanese);
    if (!Number.isSafeInteger(id) || Number(id) <= 0 || !title)
      throw new Error("Tenrai returned an invalid title.");
    const images = row(row(data.images).jpg);
    const image = text(images.large_image_url) || text(images.image_url);
    const date = row(kind === "anime" ? data.aired : data.published);
    const year =
      Number(data.year) || Number(text(date.from).match(/^\d{4}/)?.[0]);
    return {
      id: `tenrai:${kind}:${id}`,
      adapterId: this.id,
      provider: "Tenrai",
      sourceUrl: `https://myanimelist.net/${kind}/${id}`,
      type: kind === "anime" ? "Anime" : "Manga",
      title,
      coverUri: image.startsWith("https://") ? image : "",
      releaseYear: year > 0 && year <= 9999 ? year : null,
      creator: names(kind === "anime" ? data.studios : data.authors),
      summary: text(data.synopsis),
      duration:
        Number.isSafeInteger(
          kind === "anime" ? data.episodes : data.chapters,
        ) && Number(kind === "anime" ? data.episodes : data.chapters) > 0
          ? Number(kind === "anime" ? data.episodes : data.chapters)
          : null,
    };
  }
}
