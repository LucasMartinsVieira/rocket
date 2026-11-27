const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function adapter(
  reply,
  { status = 200, readKey = async () => "test-key", kind = "movie" } = {},
) {
  const calls = [];
  const exports = {};
  const source = fs.readFileSync(
    path.join(__dirname, "../src/providers/omdb.ts"),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (reply instanceof Error) throw reply;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => reply,
      };
    },
  });
  return { omdb: new exports.OmdbAdapter(readKey, kind), calls };
}

const movie = {
  imdbID: "tt1234567",
  Title: "Movie title",
  Type: "movie",
  Year: "2024",
  Poster: "N/A",
  Director: "N/A",
  Plot: "N/A",
};

test("search uses HTTPS, movie filter, encoded query and pagination", async () => {
  const { omdb, calls } = adapter({ Search: [movie], totalResults: "12" });
  const first = await omdb.search({ query: "A & B" });
  assert.equal(first.nextCursor, "2");
  assert.equal(new URL(calls[0].url).searchParams.get("page"), "1");
  const result = await omdb.search({
    query: "A & B",
    cursor: first.nextCursor,
  });
  const url = new URL(calls[1].url);
  assert.equal(url.protocol, "https:");
  assert.equal(url.searchParams.get("s"), "A & B");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("type"), "movie");
  assert.equal(result.total, 12);
  assert.equal(result.nextCursor, undefined);
  assert.equal(result.results[0].adapterId, omdb.id);
  assert.equal(result.results[0].provider, "OMDb API");
  assert.equal(result.results[0].coverUri, "");
  assert.equal(result.results[0].releaseYear, 2024);
  assert.equal(result.results[0].creator, "");
});

test("detail normalizes metadata without importing user-owned fields", async () => {
  const { omdb } = adapter({
    ...movie,
    Director: "Director",
    Runtime: "120 min",
    Plot: "Synopsis",
    Poster: "https://example.com/poster.jpg",
  });
  const result = await omdb.details({ id: movie.imdbID, adapterId: omdb.id });
  assert.equal(result.creator, "Director");
  assert.equal(result.duration, 120);
  assert.equal(result.summary, "Synopsis");
  assert.equal(result.sourceUrl, `https://www.imdb.com/title/${movie.imdbID}/`);
  assert.equal("note" in result, false);
  assert.equal("status" in result, false);
});

test("IMDb ID lookup uses ID endpoint", async () => {
  const { omdb, calls } = adapter(movie);
  const result = await omdb.search({ query: movie.imdbID });
  assert.equal(new URL(calls[0].url).searchParams.get("i"), movie.imdbID);
  assert.equal(result.total, 1);
  assert.equal(result.nextCursor, undefined);
});

const series = {
  imdbID: "tt7654321",
  Title: "Series title",
  Type: "series",
  Year: "2019–2024",
  Writer: "Series writer",
  Runtime: "45 min",
  totalSeasons: "3",
};

test("series search and preview use the existing key and normalize season totals", async () => {
  const search = adapter(
    { Search: [series], totalResults: "11" },
    { kind: "series" },
  );
  const page = await search.omdb.search({ query: "Series title" });
  const searchParams = new URL(search.calls[0].url).searchParams;
  assert.equal(searchParams.get("type"), "series");
  assert.equal(searchParams.get("apikey"), "test-key");
  assert.equal(page.nextCursor, "2");
  const first = page.results[0];
  assert.equal(first.adapterId, "omdb-series");
  assert.equal(first.type, "TV Show");
  assert.equal(first.releaseYear, 2019);

  const detail = adapter(
    { ...series, Plot: "Series synopsis" },
    { kind: "series" },
  );
  const preview = await detail.omdb.details(first);
  const detailParams = new URL(detail.calls[0].url).searchParams;
  assert.equal(detailParams.get("i"), series.imdbID);
  assert.equal(detailParams.get("type"), "series");
  assert.equal(detailParams.get("plot"), "full");
  assert.equal(preview.duration, 3);
  assert.equal(preview.creator, "Series writer");
  assert.equal(preview.summary, "Series synopsis");
});

test("IMDb ID lookup returns only the requested kind and never uses episode runtime for seasons", async () => {
  const detail = adapter(
    { ...series, totalSeasons: "N/A" },
    { kind: "series" },
  );
  const found = await detail.omdb.search({ query: series.imdbID });
  assert.equal(found.total, 1);
  assert.equal(found.results[0].duration, null);
  const movies = adapter(series);
  assert.equal((await movies.omdb.search({ query: series.imdbID })).total, 0);
  const episodes = adapter({ ...series, Type: "episode" }, { kind: "series" });
  assert.equal((await episodes.omdb.search({ query: series.imdbID })).total, 0);
});

test("missing key never sends a request", async () => {
  const { omdb, calls } = adapter({}, { readKey: async () => null });
  await assert.rejects(
    omdb.search({ query: "title" }),
    /Save your OMDb API key/,
  );
  assert.equal(calls.length, 0);
});

test("no matching titles is an empty result, not a failure", async () => {
  const { omdb } = adapter({ Response: "False", Error: "Movie not found!" });
  const result = await omdb.search({ query: "missing" });
  assert.equal(result.results.length, 0);
});

test("invalid credentials and quota have actionable errors", async () => {
  for (const [message, expected] of [
    ["Invalid API key!", /API key/],
    ["Request limit reached!", /limit reached/],
  ]) {
    const { omdb } = adapter({ Response: "False", Error: message });
    await assert.rejects(omdb.search({ query: "title" }), expected);
  }
});

test("malformed payload and non-movie result are rejected", async () => {
  for (const response of [
    null,
    {},
    { Search: [{ ...movie, Type: "series" }] },
  ]) {
    const { omdb } = adapter(response);
    await assert.rejects(omdb.search({ query: "title" }), /invalid/);
  }
});

test("HTTP rate limiting never exposes request URL or key", async () => {
  const { omdb } = adapter(
    {},
    {
      status: 429,
      readKey: async () => "private-test-secret",
    },
  );
  await assert.rejects(
    omdb.search({ query: "title" }),
    (error) =>
      /limit/.test(error.message) &&
      !error.message.includes("private-test-secret"),
  );
});

test("a full page can continue without an exact count", async () => {
  const { omdb } = adapter({
    Search: Array.from({ length: 10 }, (_, index) => ({
      ...movie,
      imdbID: `tt${1234567 + index}`,
    })),
  });
  const first = await omdb.search({ query: "title" });
  assert.equal(first.total, undefined);
  assert.equal(first.nextCursor, "2");
  const last = await omdb.search({ query: "title", cursor: "100" });
  assert.equal(last.nextCursor, undefined);
});

test("invalid preview routes and cursors do not read credentials or send requests", async () => {
  let keyReads = 0;
  const { omdb, calls } = adapter(
    {},
    {
      readKey: async () => {
        keyReads += 1;
        return "test-key";
      },
    },
  );
  await assert.rejects(
    omdb.search({ query: "title", cursor: "101" }),
    /Invalid/,
  );
  await assert.rejects(
    omdb.details({ id: movie.imdbID, adapterId: "books" }),
    /Invalid/,
  );
  assert.equal(keyReads, 0);
  assert.equal(calls.length, 0);
});

test("cancellation during credential lookup prevents a network request", async () => {
  const controller = new AbortController();
  const { omdb, calls } = adapter(
    {},
    {
      readKey: async () => {
        controller.abort();
        return "test-key";
      },
    },
  );
  await assert.rejects(
    omdb.search({ query: "title", signal: controller.signal }),
    /cancelled/,
  );
  assert.equal(calls.length, 0);
});
