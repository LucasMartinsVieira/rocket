const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function adapter(reply, status = 200) {
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
  return { omdb: exports.omdb, calls };
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
  const result = await omdb.search("A & B", "test-key", 2);
  const url = new URL(calls[0].url);
  assert.equal(url.protocol, "https:");
  assert.equal(url.searchParams.get("s"), "A & B");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("type"), "movie");
  assert.equal(result.total, 12);
  assert.equal(result.results[0].coverUri, "");
  assert.equal(result.results[0].releaseYear, 2024);
  assert.equal(result.results[0].creator, "");
});

test("detail normalizes metadata without importing user-owned fields", async () => {
  const { omdb } = adapter({
    ...movie,
    Director: "Director",
    Plot: "Synopsis",
    Poster: "https://example.com/poster.jpg",
  });
  const result = await omdb.details(movie.imdbID, "test-key");
  assert.equal(result.creator, "Director");
  assert.equal(result.summary, "Synopsis");
  assert.equal(result.sourceUrl, `https://www.imdb.com/title/${movie.imdbID}/`);
  assert.equal("note" in result, false);
  assert.equal("status" in result, false);
});

test("IMDb ID lookup uses ID endpoint", async () => {
  const { omdb, calls } = adapter(movie);
  const result = await omdb.search(movie.imdbID, "test-key", 1);
  assert.equal(new URL(calls[0].url).searchParams.get("i"), movie.imdbID);
  assert.equal(result.total, 1);
});

test("missing key never sends a request", async () => {
  const { omdb, calls } = adapter({});
  await assert.rejects(omdb.search("title", "", 1), /Save your OMDb API key/);
  assert.equal(calls.length, 0);
});

test("no matching titles is an empty result, not a failure", async () => {
  const { omdb } = adapter({ Response: "False", Error: "Movie not found!" });
  const result = await omdb.search("missing", "test-key", 1);
  assert.equal(result.results.length, 0);
});

test("invalid credentials and quota have actionable errors", async () => {
  for (const [message, expected] of [
    ["Invalid API key!", /API key/],
    ["Request limit reached!", /limit reached/],
  ]) {
    const { omdb } = adapter({ Response: "False", Error: message });
    await assert.rejects(omdb.search("title", "test-key", 1), expected);
  }
});

test("malformed payload and non-movie result are rejected", async () => {
  for (const response of [
    null,
    {},
    { Search: [{ ...movie, Type: "series" }] },
  ]) {
    const { omdb } = adapter(response);
    await assert.rejects(omdb.search("title", "test-key", 1), /invalid/);
  }
});

test("HTTP rate limiting never exposes request URL or key", async () => {
  const { omdb } = adapter({}, 429);
  await assert.rejects(
    omdb.search("title", "private-test-secret", 1),
    (error) =>
      /limit/.test(error.message) &&
      !error.message.includes("private-test-secret"),
  );
});
