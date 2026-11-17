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
      calls.push(new URL(url));
      const data = replies.shift();
      return {
        ok: !data?.status,
        status: data?.status ?? 200,
        json: async () => data,
      };
    },
  });
  return {
    ...exports,
    calls,
    primarySearch: exports.searchBooks,
    searchBooks: (query, key, page, signal) =>
      exports.searchBooks(query, key, page, signal, "google"),
  };
}
const volume = {
  id: "edition_123",
  volumeInfo: {
    title: "Book title",
    authors: ["First Author", "Second Author"],
    publishedDate: "1999-04-01",
    pageCount: 250,
    description: "<p>A <b>story</b> &amp; more.</p>",
    imageLinks: { thumbnail: "http://books.google.com/image.jpg" },
  },
};

const work = {
  key: "/works/OL123W",
  title: "Book title",
  author_name: ["Author"],
  first_publish_year: 1954,
  cover_i: 123,
};
test("Open Library is primary and needs no key", async () => {
  const api = adapter([{ docs: [work], numFound: 1 }]);
  const page = await api.primarySearch("ISBN: 978-0-123-45678-9", "", 1);
  assert.equal(api.calls[0].hostname, "openlibrary.org");
  assert.equal(api.calls[0].searchParams.get("q"), "isbn:9780123456789");
  assert.equal(api.calls[0].searchParams.has("key"), false);
  assert.equal(page.source, "openlibrary");
  assert.equal(page.results[0].creator, "Author");
});
test("no matches or primary failure use Google fallback", async () => {
  for (const response of [{ docs: [], numFound: 0 }, { status: 503 }]) {
    const api = adapter([response, { items: [volume], totalItems: 1 }]);
    const page = await api.primarySearch("book", "secret", 1);
    assert.equal(page.source, "google");
    assert.equal(api.calls[0].searchParams.has("key"), false);
    assert.equal(api.calls[1].searchParams.get("key"), "secret");
  }
});
test("Open Library details preserve authors and parse description", async () => {
  const api = adapter([
    { docs: [work], numFound: 1 },
    { description: { value: "Synopsis" } },
  ]);
  const page = await api.primarySearch("book", "", 1);
  const result = await api.bookDetails(page.results[0], "");
  assert.equal(result.creator, "Author");
  assert.equal(result.summary, "Synopsis");
});
test("Open Library pagination does not switch to Google", async () => {
  const api = adapter([{ docs: [], numFound: 10 }]);
  const page = await api.primarySearch(
    "book",
    "key",
    2,
    undefined,
    "openlibrary",
  );
  assert.equal(page.source, "openlibrary");
  assert.equal(api.calls.length, 1);
});
test("cancellation never triggers fallback", async () => {
  const api = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.primarySearch("book", "key", 1, controller.signal),
    /cancelled/,
  );
  assert.equal(api.calls.length, 0);
});

test("Google fallback uses HTTPS and normalizes metadata", async () => {
  const api = adapter([{ items: [volume], totalItems: 12 }]);
  const page = await api.searchBooks("title & author", "secret", 1);
  assert.equal(api.calls[0].origin, "https://www.googleapis.com");
  assert.equal(api.calls[0].searchParams.get("q"), "title & author");
  assert.equal(api.calls[0].searchParams.get("key"), "secret");
  assert.equal(api.calls[0].searchParams.get("printType"), "books");
  assert.equal(page.results[0].creator, "First Author, Second Author");
  assert.equal(page.results[0].releaseYear, 1999);
  assert.equal(page.results[0].duration, 250);
  assert.equal(page.results[0].summary, "A story & more.");
  assert.equal(page.results[0].coverUri, "https://books.google.com/image.jpg");
  assert.equal("status" in page.results[0], false);
});
test("edition ISBN query strips spaces and hyphens", async () => {
  const api = adapter([{ items: [volume], totalItems: 1 }]);
  await api.searchBooks("ISBN: 978-0-123-45678-9", "key", 1);
  assert.equal(api.calls[0].searchParams.get("q"), "isbn:9780123456789");
});
test("missing key never sends a request", async () => {
  const api = adapter([]);
  await assert.rejects(api.searchBooks("title", "", 1), /Google Books API key/);
  assert.equal(api.calls.length, 0);
});
test("pagination maps page to Google offset", async () => {
  const api = adapter([{ items: [volume], totalItems: 20 }]);
  await api.searchBooks("book", "key", 2);
  assert.equal(api.calls[0].searchParams.get("startIndex"), "10");
});
test("preview fetches the selected volume rather than searching by title", async () => {
  const api = adapter([{ items: [volume], totalItems: 1 }, volume]);
  const page = await api.searchBooks("book", "key", 1);
  const detail = await api.bookDetails(page.results[0], "key");
  assert.equal(api.calls[1].pathname, "/books/v1/volumes/edition_123");
  assert.equal(
    detail.sourceUrl,
    "https://books.google.com/books?id=edition_123",
  );
});
test("quota and authorization errors are actionable", async () => {
  for (const [status, message] of [
    [429, /request limit/],
    [403, /key and quota/],
  ]) {
    const api = adapter([{ status }]);
    await assert.rejects(api.searchBooks("book", "key", 1), message);
  }
});
test("cancelled requests do not send network traffic", async () => {
  const api = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.searchBooks("book", "key", 1, controller.signal),
    /cancelled/,
  );
  assert.equal(api.calls.length, 0);
});
test("missing covers and dates normalize safely; no matches is empty", async () => {
  const api = adapter([
    { items: [{ id: "id", volumeInfo: { title: "Title" } }], totalItems: 1 },
    { totalItems: 0 },
  ]);
  const page = await api.searchBooks("book", "key", 1);
  assert.equal(page.results[0].coverUri, "");
  assert.equal(page.results[0].releaseYear, null);
  assert.equal((await api.searchBooks("missing", "key", 1)).results.length, 0);
});
test("malformed results and non-Google preview IDs are rejected", async () => {
  const api = adapter([{ items: "invalid" }]);
  await assert.rejects(api.searchBooks("book", "key", 1), /invalid/);
  await assert.rejects(
    api.bookDetails({ id: "invalid" }, "key"),
    /Invalid book provider ID/,
  );
});
