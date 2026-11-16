import type { CatalogPage, CatalogResult } from "../catalog";

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
const cache = new Map<string, { data: Row; expires: number }>();
let queue: Promise<unknown> = Promise.resolve();
let lastStarted = 0;
let retryAt = 0;

async function request(path: string, signal?: AbortSignal): Promise<Row> {
  const run = async () => {
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) return cached.data;
    if (Date.now() < retryAt)
      throw new Error(
        `Tenrai request limit reached. Try again in ${Math.ceil((retryAt - Date.now()) / 1000)} seconds.`,
      );
    // Serialize requests and stay below both public limits: 4/s and 120/min.
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, lastStarted + 550 - Date.now())),
    );
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    lastStarted = Date.now();
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
        retryAt =
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
      if (cache.size >= 100) cache.clear();
      cache.set(path, { data: data as Row, expires: Date.now() + 300000 });
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
  const pending = queue.then(run);
  queue = pending.catch(() => undefined);
  return pending;
}

function normalize(value: unknown, kind: Kind): CatalogResult {
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
    provider: "Tenrai",
    sourceUrl: `https://myanimelist.net/${kind}/${id}`,
    type: kind === "anime" ? "Anime" : "Manga",
    title,
    coverUri: image.startsWith("https://") ? image : "",
    releaseYear: year > 0 && year <= 9999 ? year : null,
    creator: names(kind === "anime" ? data.studios : data.authors),
    summary: text(data.synopsis),
  };
}

export async function searchTenrai(
  query: string,
  kind: Kind,
  page: number,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  if (!query.trim() || query.length > 300)
    throw new Error("Enter a title up to 300 characters for Tenrai lookup.");
  const params = new URLSearchParams({
    q: query.trim(),
    page: String(page),
    limit: "10",
    sfw: "true",
  });
  const data = await request(`${kind}?${params}`, signal);
  if (!Array.isArray(data.data))
    throw new Error("Tenrai returned an invalid search response.");
  const results = data.data.map((item) => normalize(item, kind));
  const pagination = row(data.pagination);
  const total = Number(row(pagination.items).total);
  return {
    results,
    total:
      pagination.has_next_page === true
        ? Math.max(Number.isFinite(total) ? total : 0, page * 10 + 1)
        : (page - 1) * 10 + results.length,
  };
}

export async function tenraiDetails(
  id: string,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const match = /^tenrai:(anime|manga):(\d+)$/.exec(id);
  if (!match) throw new Error("Invalid Tenrai title ID.");
  const kind = match[1] as Kind;
  const data = await request(`${kind}/${match[2]}?sfw=true`, signal);
  return normalize(data.data, kind);
}
