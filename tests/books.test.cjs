const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function adapter(replies, readKey = async () => "secret") {
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
  return { books: new exports.BooksAdapter(readKey), calls };
}
const noWorks = { docs: [], numFound: 0 };
const fallback = (replies) => adapter([noWorks, ...replies]);
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
  let keyReads = 0;
  const api = adapter([{ docs: [work], numFound: 1 }], async () => {
    keyReads += 1;
    return null;
  });
  const page = await api.books.search({ query: "ISBN: 978-0-123-45678-9" });
  assert.equal(api.calls[0].hostname, "openlibrary.org");
  assert.equal(api.calls[0].searchParams.get("q"), "isbn:9780123456789");
  assert.equal(api.calls[0].searchParams.has("key"), false);
  assert.equal(page.results[0].provider, "Open Library");
  assert.equal(page.results[0].adapterId, "books");
  assert.equal(keyReads, 0);
  assert.equal(page.results[0].creator, "Author");
});
test("no matches or primary failure use Google fallback", async () => {
  for (const response of [noWorks, { status: 503 }]) {
    const api = adapter([response, { items: [volume], totalItems: 1 }]);
    const page = await api.books.search({ query: "book" });
    assert.equal(page.results[0].provider, "Google Books");
    assert.equal(page.results[0].adapterId, "books");
    assert.equal(api.calls[0].searchParams.has("key"), false);
    assert.equal(api.calls[1].searchParams.get("key"), "secret");
  }
});
test("Open Library details preserve authors and parse description", async () => {
  const api = adapter(
    [{ docs: [work], numFound: 1 }, { description: { value: "Synopsis" } }],
    async () => {
      throw new Error("Unexpected key read");
    },
  );
  const page = await api.books.search({ query: "book" });
  const result = await api.books.details(page.results[0]);
  assert.equal(result.creator, "Author");
  assert.equal(result.summary, "Synopsis");
});
test("Open Library pagination does not switch to Google", async () => {
  for (const next of [noWorks, { status: 503 }]) {
    const api = adapter([{ docs: [work], numFound: 20 }, next]);
    const first = await api.books.search({ query: "book" });
    assert.ok(first.nextCursor);
    const more = api.books.search({ query: "book", cursor: first.nextCursor });
    if (next.status) await assert.rejects(more, /Open Library is unavailable/);
    else assert.equal((await more).nextCursor, undefined);
    assert.equal(api.calls.length, 2);
    assert.equal(api.calls[1].hostname, "openlibrary.org");
    assert.equal(api.calls[1].searchParams.get("page"), "2");
  }
});
test("cancellation never triggers fallback", async () => {
  const api = adapter([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.books.search({ query: "book", signal: controller.signal }),
    /cancelled/,
  );
  assert.equal(api.calls.length, 0);
});

test("Google fallback uses HTTPS and normalizes metadata", async () => {
  const api = fallback([{ items: [volume], totalItems: 12 }]);
  const page = await api.books.search({ query: "title & author" });
  assert.equal(api.calls[1].origin, "https://www.googleapis.com");
  assert.equal(api.calls[1].searchParams.get("q"), "title & author");
  assert.equal(api.calls[1].searchParams.get("key"), "secret");
  assert.equal(api.calls[1].searchParams.get("printType"), "books");
  assert.equal(page.results[0].creator, "First Author, Second Author");
  assert.equal(page.results[0].releaseYear, 1999);
  assert.equal(page.results[0].duration, 250);
  assert.equal(page.results[0].summary, "A story & more.");
  assert.equal(page.results[0].coverUri, "https://books.google.com/image.jpg");
  assert.equal("status" in page.results[0], false);
});
test("edition ISBN query strips spaces and hyphens", async () => {
  const api = fallback([{ items: [volume], totalItems: 1 }]);
  await api.books.search({ query: "ISBN: 978-0-123-45678-9" });
  assert.equal(api.calls[1].searchParams.get("q"), "isbn:9780123456789");
});
test("missing key never sends a Google Books request", async () => {
  const api = adapter([noWorks], async () => null);
  await assert.rejects(
    api.books.search({ query: "title" }),
    /Google Books API key/,
  );
  await assert.rejects(
    api.books.details({ adapterId: "books", id: "google:edition_123" }),
    /Google Books API key/,
  );
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].hostname, "openlibrary.org");
});
test("pagination maps page to Google offset", async () => {
  const api = fallback([
    { items: [volume], totalItems: 20 },
    { items: [{ ...volume, id: "another" }], totalItems: 20 },
  ]);
  const first = await api.books.search({ query: "book" });
  const second = await api.books.search({
    query: "book",
    cursor: first.nextCursor,
  });
  assert.equal(api.calls.length, 3);
  assert.equal(api.calls[2].hostname, "www.googleapis.com");
  assert.equal(api.calls[2].searchParams.get("startIndex"), "10");
  assert.equal(second.results[0].id, "google:another");
  assert.equal(second.nextCursor, undefined);
});
test("preview fetches the selected volume rather than searching by title", async () => {
  const api = fallback([{ items: [volume], totalItems: 1 }, volume]);
  const page = await api.books.search({ query: "book" });
  const detail = await api.books.details(page.results[0]);
  assert.equal(api.calls[2].pathname, "/books/v1/volumes/edition_123");
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
    const api = fallback([{ status }]);
    await assert.rejects(api.books.search({ query: "book" }), message);
  }
});
test("cancellation while loading a fallback key never sends Google Books traffic", async () => {
  const controller = new AbortController();
  const api = adapter([noWorks], async () => {
    controller.abort();
    return "secret";
  });
  await assert.rejects(
    api.books.search({ query: "book", signal: controller.signal }),
    /cancelled/,
  );
  assert.equal(api.calls.length, 1);
});
test("missing covers and dates normalize safely; no matches is empty", async () => {
  const api = fallback([
    { items: [{ id: "id", volumeInfo: { title: "Title" } }], totalItems: 1 },
    noWorks,
    { totalItems: 0 },
  ]);
  const page = await api.books.search({ query: "book" });
  assert.equal(page.results[0].coverUri, "");
  assert.equal(page.results[0].releaseYear, null);
  assert.equal(
    (await api.books.search({ query: "missing" })).results.length,
    0,
  );
});
test("malformed results and non-Google preview IDs are rejected", async () => {
  const api = fallback([{ items: "invalid" }]);
  await assert.rejects(api.books.search({ query: "book" }), /invalid/);
  await assert.rejects(
    api.books.details({ id: "invalid", adapterId: "books" }),
    /Invalid book provider ID/,
  );
  await assert.rejects(
    api.books.search({ query: "book", cursor: "google:0" }),
    /Invalid book search page/,
  );
  assert.equal(api.calls.length, 2);
});
