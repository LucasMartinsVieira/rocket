const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function adapter(replies) {
  const calls = [];
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/providers/igdb.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url: new URL(url), options });
      const next = replies.shift();
      if (!next) throw new Error("Unexpected request");
      return {
        ok: (next.status ?? 200) < 400,
        status: next.status ?? 200,
        headers: { get: () => next.retryAfter ?? null },
        json: async () => next.data,
      };
    },
  });
  return { ...exports, calls };
}
const credentials = JSON.stringify({
  clientId: "personalclient",
  clientSecret: "privatesecret",
});
const auth = {
  data: {
    access_token: "temporarytoken",
    expires_in: 3600,
    token_type: "bearer",
  },
};
const game = {
  id: 123,
  name: "Game title",
  slug: "game-title",
  first_release_date: 1645747200,
  cover: { image_id: "co1234" },
  involved_companies: [
    { developer: true, company: { name: "Developer" } },
    { developer: false, company: { name: "Publisher" } },
  ],
  summary: "Synopsis",
  aggregated_rating: 90,
};

test("personal credentials use Twitch POST body; IGDB gets only token and Client ID", async () => {
  const api = adapter([auth, { data: [game] }]);
  const result = await api.igdb.search("Game", credentials, 1);
  assert.equal(api.calls[0].url.href, "https://id.twitch.tv/oauth2/token");
  const body = new URLSearchParams(api.calls[0].options.body);
  assert.equal(body.get("client_secret"), "privatesecret");
  assert.equal(body.get("grant_type"), "client_credentials");
  assert.equal(api.calls[1].url.href, "https://api.igdb.com/v4/games");
  assert.equal(
    api.calls[1].options.headers.Authorization,
    "Bearer temporarytoken",
  );
  assert.equal(api.calls[1].options.headers["Client-ID"], "personalclient");
  assert.equal(JSON.stringify(api.calls[1]).includes("privatesecret"), false);
  assert.equal(result.results[0].creator, "Developer");
  assert.equal(
    result.results[0].sourceUrl,
    "https://www.igdb.com/games/game-title",
  );
  assert.equal(result.results[0].releaseYear, 2022);
  assert.equal(result.results[0].duration, null);
  assert.equal("rating" in result.results[0], false);
});
test("search safely quotes user input and uses pagination lookahead", async () => {
  const api = adapter([
    auth,
    { data: Array.from({ length: 11 }, (_, i) => ({ ...game, id: i + 1 })) },
  ]);
  const query = 'Game"; fields *;\n';
  const result = await api.igdb.search(query, credentials, 2);
  assert.ok(
    api.calls[1].options.body.includes(
      `search ${JSON.stringify(query.trim())};`,
    ),
  );
  assert.ok(api.calls[1].options.body.includes("limit 11; offset 10;"));
  assert.equal(result.results.length, 10);
  assert.equal(result.total, 21);
});
test("cached token is reused and cleared when credentials are removed", async () => {
  const api = adapter([
    auth,
    { data: [game] },
    { data: [game] },
    auth,
    { data: [game] },
  ]);
  await api.igdb.search("Game", credentials, 1);
  await api.igdb.details("igdb:123", credentials);
  assert.equal(api.calls.length, 3);
  api.clearIgdbSession();
  await api.igdb.details("igdb:123", credentials);
  assert.equal(api.calls.length, 5);
  assert.equal(api.calls[3].url.hostname, "id.twitch.tv");
});
test("401 refreshes authentication once then retries", async () => {
  const api = adapter([auth, { status: 401 }, auth, { data: [game] }]);
  assert.equal(
    (await api.igdb.details("igdb:123", credentials)).title,
    "Game title",
  );
  assert.equal(api.calls.length, 4);
});
test("expiring tokens are renewed before subsequent calls", async () => {
  const api = adapter([
    { data: { access_token: "expiring", expires_in: 1 } },
    { data: [game] },
    auth,
    { data: [game] },
  ]);
  await api.igdb.search("Game", credentials, 1);
  await api.igdb.details("igdb:123", credentials);
  assert.equal(api.calls[2].url.hostname, "id.twitch.tv");
  assert.equal(
    api.calls[3].options.headers.Authorization,
    "Bearer temporarytoken",
  );
});
test("repeated 401 stops and does not expose secrets", async () => {
  const api = adapter([auth, { status: 401 }, auth, { status: 401 }]);
  await assert.rejects(
    api.igdb.details("igdb:123", credentials),
    (error) =>
      /authentication/.test(error.message) &&
      !error.message.includes("privatesecret"),
  );
  assert.equal(api.calls.length, 4);
});
test("missing credentials and invalid IDs send no requests", async () => {
  const api = adapter([]);
  await assert.rejects(api.igdb.search("Game", "", 1), /personal Twitch/);
  await assert.rejects(
    api.igdb.details("igdb:../secrets", credentials),
    /Invalid/,
  );
  assert.equal(api.calls.length, 0);
});
test("cancellation and credential invalidation prevent pending work", async () => {
  const api = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.igdb.search("Game", credentials, 1, controller.signal),
    /cancelled/,
  );
  const pending = api.igdb.search("Game", credentials, 1);
  api.clearIgdbSession();
  await assert.rejects(pending, /credentials changed/);
  assert.equal(api.calls.length, 0);
});
test("quota errors block subsequent traffic until Retry-After", async () => {
  const api = adapter([auth, { status: 429, retryAfter: "60" }]);
  await assert.rejects(api.igdb.search("Game", credentials, 1), /limit/);
  await assert.rejects(api.igdb.search("Other", credentials, 1), /seconds/);
  assert.equal(api.calls.length, 2);
});
test("missing metadata and no results are supported", async () => {
  const api = adapter([
    auth,
    { data: [] },
    { data: [{ id: 1, name: "Unknown", storyline: "Story" }] },
  ]);
  assert.equal((await api.igdb.search("Missing", credentials, 1)).total, 0);
  const result = await api.igdb.details("igdb:1", credentials);
  assert.equal(result.coverUri, "");
  assert.equal(result.creator, "");
  assert.equal(result.releaseYear, null);
  assert.equal(result.summary, "Story");
});
test("malformed authentication and API payloads are rejected", async () => {
  await assert.rejects(
    adapter([{ data: {} }]).igdb.search("Game", credentials, 1),
    /authentication response/,
  );
  await assert.rejects(
    adapter([auth, { data: {} }]).igdb.search("Game", credentials, 1),
    /invalid response/,
  );
  await assert.rejects(
    adapter([auth, { data: [{}] }]).igdb.search("Game", credentials, 1),
    /invalid game/,
  );
});
