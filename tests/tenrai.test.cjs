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
  const client = new exports.TenraiClient();
  return {
    anime: new exports.TenraiAdapter("anime", client),
    manga: new exports.TenraiAdapter("manga", client),
    calls,
  };
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
  const result = await api.anime.search({ query: "title & alternate" });
  assert.equal(api.calls[0].url.origin, "https://api.tenrai.org");
  assert.equal(api.calls[0].url.searchParams.get("q"), "title & alternate");
  assert.equal(api.calls[0].url.searchParams.get("sfw"), "true");
  assert.equal(api.calls[0].options.headers, undefined);
  assert.equal(result.results[0].creator, "Studio");
  assert.equal(result.results[0].releaseYear, 1998);
  assert.equal(result.results[0].duration, 26);
  assert.equal(result.results[0].type, "Anime");
  assert.equal(result.results[0].adapterId, "tenrai-anime");
  assert.equal("status" in result.results[0], false);
  assert.equal("episodes" in result.results[0], false);
});
test("manga maps author and publication year and has distinct ID", async () => {
  const api = adapter([page(manga)]);
  const result = await api.manga.search({ query: "title" });
  assert.equal(result.results[0].id, "tenrai:manga:1");
  assert.equal(result.results[0].adapterId, "tenrai-manga");
  assert.equal(result.results[0].creator, "Author");
  assert.equal(result.results[0].releaseYear, 1994);
  assert.equal(result.results[0].coverUri, "");
});
test("pagination respects has_next_page", async () => {
  const api = adapter([
    { data: [anime], pagination: { has_next_page: true } },
    {
      ...page({ ...anime, mal_id: 2 }),
      pagination: { has_next_page: false, items: { total: 25 } },
    },
  ]);
  const first = await api.anime.search({ query: "title" });
  assert.equal(first.total, undefined);
  assert.equal(first.nextCursor, "2");
  const second = await api.anime.search({
    query: "title",
    cursor: first.nextCursor,
  });
  assert.equal(second.results.length, 1);
  assert.equal(second.total, 25);
  assert.equal(second.nextCursor, undefined);
  assert.equal(api.calls[1].url.searchParams.get("page"), "2");
});
test("preview fetches correct kind and ID; repeated requests use cache", async () => {
  const api = adapter([{ data: manga }]);
  const result = await api.manga.details({
    id: "tenrai:manga:1",
    adapterId: "tenrai-manga",
  });
  assert.equal(result.sourceUrl, "https://myanimelist.net/manga/1");
  await api.manga.details(result);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url.pathname, "/v1/manga/1");
  assert.equal(api.calls[0].url.searchParams.get("sfw"), "true");
});
test("concurrent requests are paced and serialized", async () => {
  const api = adapter([page(anime), page(manga)]);
  await Promise.all([
    api.anime.search({ query: "title" }),
    api.manga.search({ query: "title" }),
  ]);
  assert.ok(api.calls[1].time - api.calls[0].time >= 500);
});
test("rate limit honors Retry-After without another request", async () => {
  const api = adapter([{ status: 429 }]);
  await assert.rejects(api.anime.search({ query: "title" }), /limit/);
  await assert.rejects(api.manga.search({ query: "other" }), /seconds/);
  assert.equal(api.calls.length, 1);
});
test("cancelled request sends no traffic", async () => {
  const api = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.anime.search({ query: "title", signal: controller.signal }),
    /cancelled/,
  );
  assert.equal(api.calls.length, 0);
});
test("malformed and missing titles are rejected", async () => {
  const api = adapter([{ data: [{}] }]);
  await assert.rejects(api.anime.search({ query: "title" }), /invalid/);
  await assert.rejects(
    api.manga.details({ id: "invalid", adapterId: "tenrai-manga" }),
    /Invalid Tenrai/,
  );
});

test("wrong routes, kinds, and cursors are rejected before fetching", async () => {
  const api = adapter([]);
  for (const result of [
    { id: "tenrai:manga:1", adapterId: "tenrai-manga" },
    { id: "tenrai:manga:1", adapterId: "tenrai-anime" },
  ]) {
    await assert.rejects(api.anime.details(result), /Invalid Tenrai/);
  }
  await assert.rejects(
    api.manga.search({ query: "title", cursor: "0" }),
    /Invalid Tenrai/,
  );
  assert.equal(api.calls.length, 0);
});
