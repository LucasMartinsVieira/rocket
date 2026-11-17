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
    fs.readFileSync(path.join(__dirname, "../src/providers/tenrai.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url: new URL(url), options, time: Date.now() });
      const data = replies.shift();
      return {
        ok: !data?.status,
        status: data?.status ?? 200,
        headers: { get: () => "60" },
        json: async () => data,
      };
    },
  });
  return { ...exports, calls };
}
const anime = {
  mal_id: 1,
  title: "Anime title",
  year: 1998,
  studios: [{ name: "Studio" }],
  images: { jpg: { large_image_url: "https://example.com/cover.jpg" } },
  synopsis: "Summary",
  episodes: 26,
};
const manga = {
  mal_id: 1,
  title: "Manga title",
  authors: [{ name: "Author" }],
  published: { from: "1994-12-05" },
};
const page = (entry, next = false) => ({
  data: [entry],
  pagination: { has_next_page: next, items: { total: next ? 25 : 1 } },
});

test("anime search normalizes studios, image, year without status or progress", async () => {
  const api = adapter([page(anime)]);
  const result = await api.searchTenrai("title & alternate", "anime", 1);
  assert.equal(api.calls[0].url.origin, "https://api.tenrai.org");
  assert.equal(api.calls[0].url.searchParams.get("q"), "title & alternate");
  assert.equal(api.calls[0].url.searchParams.get("sfw"), "true");
  assert.equal(api.calls[0].options.headers, undefined);
  assert.equal(result.results[0].creator, "Studio");
  assert.equal(result.results[0].releaseYear, 1998);
  assert.equal(result.results[0].duration, 26);
  assert.equal(result.results[0].type, "Anime");
  assert.equal("status" in result.results[0], false);
  assert.equal("episodes" in result.results[0], false);
});
test("manga maps author and publication year and has distinct ID", async () => {
  const api = adapter([page(manga)]);
  const result = await api.searchTenrai("title", "manga", 1);
  assert.equal(result.results[0].id, "tenrai:manga:1");
  assert.equal(result.results[0].creator, "Author");
  assert.equal(result.results[0].releaseYear, 1994);
  assert.equal(result.results[0].coverUri, "");
});
test("pagination respects has_next_page", async () => {
  const api = adapter([
    page(anime, true),
    { data: [], pagination: { has_next_page: false } },
  ]);
  assert.equal((await api.searchTenrai("title", "anime", 1)).total, 25);
  assert.equal((await api.searchTenrai("title", "anime", 2)).results.length, 0);
  assert.equal(api.calls[1].url.searchParams.get("page"), "2");
});
test("preview fetches correct kind and ID; repeated requests use cache", async () => {
  const api = adapter([{ data: manga }]);
  const result = await api.tenraiDetails("tenrai:manga:1");
  assert.equal(result.sourceUrl, "https://myanimelist.net/manga/1");
  await api.tenraiDetails("tenrai:manga:1");
  assert.equal(api.calls.length, 1);
});
test("concurrent requests are paced and serialized", async () => {
  const api = adapter([page(anime), page(manga)]);
  await Promise.all([
    api.searchTenrai("title", "anime", 1),
    api.searchTenrai("title", "manga", 1),
  ]);
  assert.ok(api.calls[1].time - api.calls[0].time >= 500);
});
test("rate limit honors Retry-After without another request", async () => {
  const api = adapter([{ status: 429 }]);
  await assert.rejects(api.searchTenrai("title", "anime", 1), /limit/);
  await assert.rejects(api.searchTenrai("other", "manga", 1), /seconds/);
  assert.equal(api.calls.length, 1);
});
test("cancelled request sends no traffic", async () => {
  const api = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.searchTenrai("title", "anime", 1, controller.signal),
    /cancelled/,
  );
  assert.equal(api.calls.length, 0);
});
test("malformed and missing titles are rejected", async () => {
  const api = adapter([{ data: [{}] }]);
  await assert.rejects(api.searchTenrai("title", "anime", 1), /invalid/);
  await assert.rejects(api.tenraiDetails("invalid"), /Invalid Tenrai/);
});
