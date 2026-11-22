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
    fs.readFileSync(path.join(__dirname, "../src/providers/books.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url) => {
      const parsed = new URL(url);
      assert.equal(parsed.origin, "https://openlibrary.org");
      assert.equal(parsed.searchParams.has("key"), false);
      calls.push(parsed);
      assert.ok(replies.length, "Unexpected request");
      const data = replies.shift();
      return {
        ok: !data?.status,
        status: data?.status ?? 200,
        json: async () => data,
      };
    },
  });
  return { books: new exports.BooksAdapter(), calls };
}

const work = {
  key: "/works/OL123W",
  title: "Book title",
  author_name: ["Author"],
  first_publish_year: 1954,
  cover_i: 123,
};

test("Open Library search is keyless and normalizes ISBN and metadata", async () => {
  const { books, calls } = adapter([{ docs: [work], numFound: 1 }]);
  const page = await books.search({ query: "ISBN: 978-0-123-45678-9" });
  assert.equal(calls[0].pathname, "/search.json");
  assert.equal(calls[0].searchParams.get("q"), "isbn:9780123456789");
  assert.equal(page.total, 1);
  const [result] = page.results;
  assert.equal(result.id, "openlibrary:OL123W");
  assert.equal(result.adapterId, books.id);
  assert.equal(result.provider, "Open Library");
  assert.equal(result.creator, "Author");
  assert.equal(result.releaseYear, 1954);
  assert.equal(
    result.coverUri,
    "https://covers.openlibrary.org/b/id/123-M.jpg?default=false",
  );
  assert.equal("status" in result, false);
});

test("Open Library pagination uses the returned cursor and stops on the final page", async () => {
  const { books, calls } = adapter([
    { docs: [work], numFound: 12 },
    { docs: [{ ...work, key: "/works/OL456W" }], num_found: 12 },
  ]);
  const first = await books.search({ query: "title & author" });
  const second = await books.search({
    query: "title & author",
    cursor: first.nextCursor,
  });
  assert.equal(calls[0].searchParams.get("page"), "1");
  assert.equal(calls[1].searchParams.get("page"), "2");
  assert.equal(calls[1].searchParams.get("q"), "title & author");
  assert.equal(second.results[0].id, "openlibrary:OL456W");
  assert.equal(second.nextCursor, undefined);
});

test("no matches returns an empty page, without a fallback request", async () => {
  const { books, calls } = adapter([{ docs: [], numFound: 0 }]);
  const page = await books.search({ query: "no matches" });
  assert.equal(page.results.length, 0);
  assert.equal(page.total, 0);
  assert.equal(page.nextCursor, undefined);
  assert.equal(calls.length, 1);
});

test("previews enrich Open Library results and preserve existing search metadata", async () => {
  const { books, calls } = adapter([
    {
      docs: [{ ...work, cover_i: null, first_publish_year: null }],
      numFound: 1,
    },
    { description: { value: "Synopsis" }, covers: [456] },
  ]);
  const page = await books.search({ query: "book" });
  assert.equal(page.results[0].coverUri, "");
  assert.equal(page.results[0].releaseYear, null);
  const result = await books.details(page.results[0]);
  assert.equal(calls[1].pathname, "/works/OL123W.json");
  assert.equal(result.creator, "Author");
  assert.equal(result.summary, "Synopsis");
  assert.equal(
    result.coverUri,
    "https://covers.openlibrary.org/b/id/456-M.jpg?default=false",
  );
  assert.equal(result.sourceUrl, "https://openlibrary.org/works/OL123W");
});

test("Open Library failures and malformed book data do not trigger a fallback", async () => {
  for (const [reply, message] of [
    [{ status: 429 }, /Open Library request limit/],
    [{ status: 503 }, /Open Library is unavailable.*enter manually/],
    [{ docs: "invalid" }, /invalid search response/],
    [{ docs: [{}] }, /invalid book/],
  ]) {
    const { books, calls } = adapter([reply]);
    await assert.rejects(books.search({ query: "book" }), message);
    assert.equal(calls.length, 1);
  }
});

test("cancelled lookups and invalid cursors or IDs never send a request", async () => {
  const { books, calls } = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    books.search({ query: "book", signal: controller.signal }),
    /cancelled/,
  );
  await assert.rejects(
    books.search({ query: "book", cursor: "not-a-page" }),
    /Invalid book search page/,
  );
  await assert.rejects(
    books.details({ adapterId: "books", id: "invalid-book-id" }),
    /Invalid book provider ID/,
  );
  assert.equal(calls.length, 0);
});
