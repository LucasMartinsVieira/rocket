import type { CatalogProvider, CatalogResult } from "../catalog";

type Credentials = { clientId: string; clientSecret: string };
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export function parseIgdbCredentials(value: string): Credentials {
  try {
    const data = row(JSON.parse(value));
    if (
      /^[a-zA-Z0-9]+$/.test(text(data.clientId)) &&
      /^[a-zA-Z0-9]+$/.test(text(data.clientSecret))
    ) {
      return {
        clientId: text(data.clientId),
        clientSecret: text(data.clientSecret),
      };
    }
  } catch {
    /* Never include credentials in errors. */
  }
  throw new Error(
    "Save your personal Twitch Client ID and Client Secret in Settings → Provider Integrations first.",
  );
}

let session: { clientId: string; token: string; expires: number } | null = null;
let revision = 0;
let queue: Promise<unknown> = Promise.resolve();
let lastStarted = 0;
let retryAt = 0;
export function clearIgdbSession() {
  session = null;
  revision += 1;
}

function rateLimit(retryAfter: string | null) {
  const seconds = Number(retryAfter);
  const dateDelay = Date.parse(retryAfter ?? "") - Date.now();
  const delay =
    retryAfter && Number.isFinite(seconds)
      ? Math.max(1, seconds) * 1000
      : Number.isFinite(dateDelay)
        ? Math.max(1000, dateDelay)
        : 60000;
  retryAt = Date.now() + delay;
  return new Error(
    "IGDB/Twitch request limit reached. Wait before trying again.",
  );
}

async function http(url: string, options: RequestInit, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Lookup cancelled.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    return {
      status: response.status,
      ok: response.ok,
      retryAfter: response.headers.get("Retry-After"),
      data,
    };
  } catch {
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    if (controller.signal.aborted)
      throw new Error("IGDB request timed out. Try again or enter manually.");
    throw new Error(
      "Could not reach IGDB or Twitch. Check your connection or enter manually.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function request(
  body: string,
  key: string,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const credentials = parseIgdbCredentials(key);
  const startedRevision = revision;
  const run = async () => {
    const check = () => {
      if (signal?.aborted) throw new Error("Lookup cancelled.");
      if (startedRevision !== revision)
        throw new Error("IGDB credentials changed. Submit the lookup again.");
    };
    check();
    if (Date.now() < retryAt)
      throw new Error(
        `IGDB request limit reached. Try again in ${Math.ceil((retryAt - Date.now()) / 1000)} seconds.`,
      );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (
        !session ||
        session.clientId !== credentials.clientId ||
        session.expires <= Date.now()
      ) {
        const auth = await http(
          "https://id.twitch.tv/oauth2/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
              grant_type: "client_credentials",
            }).toString(),
          },
          signal,
        );
        check();
        if (auth.status === 429) throw rateLimit(auth.retryAfter);
        if (!auth.ok)
          throw new Error(
            "Twitch could not authenticate. Check your personal Client ID and Client Secret, then try again later.",
          );
        const data = row(auth.data);
        if (
          !text(data.access_token) ||
          typeof data.expires_in !== "number" ||
          data.expires_in <= 0
        )
          throw new Error(
            "Twitch returned an invalid authentication response.",
          );
        session = {
          clientId: credentials.clientId,
          token: text(data.access_token),
          expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
        };
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, lastStarted + 300 - Date.now())),
      );
      check();
      lastStarted = Date.now();
      const response = await http(
        "https://api.igdb.com/v4/games",
        {
          method: "POST",
          headers: {
            "Client-ID": credentials.clientId,
            Authorization: `Bearer ${session.token}`,
            Accept: "application/json",
            "Content-Type": "text/plain",
          },
          body,
        },
        signal,
      );
      check();
      if (response.status === 401) {
        session = null;
        if (attempt === 0) continue;
        throw new Error(
          "IGDB rejected authentication. Update your Twitch credentials.",
        );
      }
      if (response.status === 429) {
        throw rateLimit(response.retryAfter);
      }
      if (response.status === 403)
        throw new Error(
          "IGDB denied access. Check your Twitch application and IGDB eligibility.",
        );
      if (!response.ok)
        throw new Error(
          "IGDB is unavailable. Try again later or enter manually.",
        );
      if (!Array.isArray(response.data))
        throw new Error("IGDB returned an invalid response.");
      return response.data;
    }
    throw new Error("IGDB authentication failed.");
  };
  const pending = queue.then(run);
  queue = pending.catch(() => undefined);
  return pending;
}

const fields =
  "fields name,slug,cover.image_id,first_release_date,involved_companies.developer,involved_companies.company.name,summary,storyline;";
function normalize(value: unknown): CatalogResult {
  const data = row(value);
  if (
    !Number.isSafeInteger(data.id) ||
    Number(data.id) <= 0 ||
    !text(data.name)
  )
    throw new Error("IGDB returned an invalid game result.");
  const image = text(row(data.cover).image_id);
  const slug = text(data.slug);
  const year =
    typeof data.first_release_date === "number"
      ? new Date(data.first_release_date * 1000).getUTCFullYear()
      : 0;
  return {
    id: `igdb:${data.id}`,
    provider: "IGDB",
    type: "Game",
    title: text(data.name),
    sourceUrl: /^[a-z0-9-]+$/.test(slug)
      ? `https://www.igdb.com/games/${slug}`
      : "https://www.igdb.com/",
    coverUri: /^[a-zA-Z0-9_-]+$/.test(image)
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${image}.jpg`
      : "",
    releaseYear: year > 0 && year <= 9999 ? year : null,
    creator: Array.isArray(data.involved_companies)
      ? data.involved_companies
          .filter((item) => row(item).developer === true)
          .map((item) => text(row(row(item).company).name))
          .filter(Boolean)
          .join(", ")
      : "",
    summary: text(data.summary) || text(data.storyline),
    duration: null,
  };
}

export const igdb: CatalogProvider = {
  async search(query, key, page, signal) {
    if (!query.trim() || query.length > 300)
      throw new Error("Enter a game title up to 300 characters.");
    if (!Number.isInteger(page) || page < 1)
      throw new Error("Invalid IGDB page.");
    // JSON string quoting prevents APICalypse query injection, including quotes and newlines.
    const data = await request(
      `${fields} search ${JSON.stringify(query.trim())}; limit 11; offset ${(page - 1) * 10};`,
      key,
      signal,
    );
    return {
      results: data.slice(0, 10).map(normalize),
      total: (page - 1) * 10 + data.length,
    };
  },
  async details(id, key, signal) {
    const match = /^igdb:([1-9]\d*)$/.exec(id);
    if (!match) throw new Error("Invalid IGDB game ID.");
    const data = await request(
      `${fields} where id = ${match[1]}; limit 1;`,
      key,
      signal,
    );
    if (!data.length)
      throw new Error("This game is no longer available on IGDB.");
    return normalize(data[0]);
  },
};
