const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => dependencies[name],
    console,
  });
  return exports;
}
const model = load("model.ts");
const backup = load("backup.ts", { "./model": model });

function openDatabase(native) {
  const connection = {
    execAsync: async (sql) => native.exec(sql),
    getAllAsync: async (sql, ...params) => native.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) =>
      native.prepare(sql).get(...params) ?? null,
    runAsync: async (sql, ...params) => native.prepare(sql).run(...params),
    withTransactionAsync: async (task) => {
      native.exec("BEGIN");
      try {
        await task();
        native.exec("COMMIT");
      } catch (error) {
        native.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return load("database.ts", {
    "./model": model,
    "./backup": backup,
    "expo-sqlite": {
      openDatabaseAsync: async () => ({
        ...connection,
        withExclusiveTransactionAsync: (task) =>
          connection.withTransactionAsync(() => task(connection)),
      }),
    },
  });
}

test("JSON backup round trips metadata, links, notes, journals and ordered lists through SQLite", async () => {
  const original = new DatabaseSync(":memory:");
  const target = new DatabaseSync(":memory:");
  try {
    const app = openDatabase(original);
    const copy = openDatabase(target);
    const first = await app.saveEntry({
      ...model.emptyDraft(),
      type: "Book",
      title: "First",
      alternateTitles: ["本"],
      creator: "Author",
      creatorRole: "Author",
      releaseYear: 2011,
      rating: 4,
      duration: 300,
      note: "A private note 📚",
      status: "Revisiting",
      summary: "Synopsis",
      coverUri: "https://example.com/cover.jpg",
      sourceUrl: "https://example.com/book",
    });
    const second = await app.saveEntry({
      ...model.emptyDraft(),
      type: "Book",
      title: "Second",
    });
    const list = await app.createList(
      "Reading",
      "Book",
      "Favorites",
      "Sunset",
      [first, second],
      "heart",
    );
    await app.reorderListEntries(list, [second, first]);
    await app.createList("Empty", "Game", "", "Dusk", []);
    await app.createJournalEntry(first, "Journal entry");
    const file = JSON.stringify(await app.exportLibraryBackup());
    const decoded = backup.parseBackup(file);
    assert.equal(file.includes("listIds"), false);
    assert.deepEqual(Object.keys(decoded), [
      "format",
      "version",
      "exportedAt",
      "entries",
      "lists",
      "journals",
    ]);
    await copy.saveEntry({ ...model.emptyDraft(), title: "Old library" });
    await copy.database();
    target.exec("PRAGMA foreign_keys = OFF");
    await copy.replaceLibraryFromBackup(decoded);
    const result = await openDatabase(target).exportLibraryBackup();
    assert.equal(
      JSON.stringify({ ...result, exportedAt: decoded.exportedAt }),
      JSON.stringify(decoded),
    );
    assert.deepEqual(Array.from(await copy.getListEntryIds(list)), [
      second,
      first,
    ]);
    assert.deepEqual(Array.from(backup.restoredLibrary(decoded).order[list]), [
      second,
      first,
    ]);
    assert.equal((await copy.getJournal(first))[0].body, "Journal entry");
  } finally {
    original.close();
    target.close();
  }
});

test("invalid backup never writes; transaction failure after deletes rolls back all rows", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const app = openDatabase(db);
    const id = await app.saveEntry({
      ...model.emptyDraft(),
      title: "Keep this",
      note: "Note",
    });
    await app.createJournalEntry(id, "Keep this too");
    await app.createList("My list", "Anime", "", "Dusk", [id]);
    const saved = await app.exportLibraryBackup();
    const change = (mutate) => {
      const input = structuredClone(saved);
      mutate(input);
      return input;
    };
    assert.throws(() => backup.parseBackup("{"), { kind: "invalid" });
    assert.throws(
      () =>
        backup.validateBackup(
          change((x) => {
            x.version = 2;
          }),
        ),
      { kind: "version" },
    );
    for (const mutate of [
      (x) => x.entries.push(x.entries[0]),
      (x) => x.lists.push({ ...x.lists[0], id: "different", name: "MY LIST" }),
      (x) => x.lists[0].entryIds.push(id),
      (x) => {
        x.lists[0].type = "Book";
      },
      (x) => {
        x.lists[0].entryIds = ["missing"];
      },
      (x) => {
        x.journals[0].mediaId = "missing";
      },
      (x) => {
        x.entries[0].rating = 6;
      },
      (x) => {
        x.entries[0].updatedAt = "2026-02-31T00:00:00.000Z";
      },
    ])
      await assert.rejects(app.replaceLibraryFromBackup(change(mutate)), {
        kind: "invalid",
      });

    db.exec(
      "CREATE TRIGGER simulate_restore_failure BEFORE INSERT ON journal_entries BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    await assert.rejects(
      app.replaceLibraryFromBackup(
        change((x) => {
          x.entries[0].title = "Replacement";
        }),
      ),
      /test failure/,
    );
    assert.equal(
      JSON.stringify({
        ...(await app.exportLibraryBackup()),
        exportedAt: saved.exportedAt,
      }),
      JSON.stringify(saved),
    );
    const empty = change((x) => {
      x.entries = [];
      x.lists = [];
      x.journals = [];
    });
    await app.replaceLibraryFromBackup(empty);
    assert.equal(
      JSON.stringify({
        ...(await app.exportLibraryBackup()),
        exportedAt: empty.exportedAt,
      }),
      JSON.stringify(backup.validateBackup(empty)),
    );
  } finally {
    db.close();
  }
});

test("16 distinct list icons and duration units", () => {
  assert.equal(model.LIST_ICONS.length, 16);
  assert.equal(new Set(model.LIST_ICONS.map((icon) => icon.name)).size, 16);
  assert.equal(model.formatDuration("Movie", 120), "120 min");
  assert.equal(model.formatDuration("Book", 1), "1 page");
  assert.equal(model.formatDuration("Manga", 12), "12 chapters");
  assert.equal(model.formatDuration("Anime", 24), "24 episodes");
  assert.equal(model.formatDuration("Game", 10), null);
  assert.equal(model.formatDuration("Book", null), null);
});

test("legacy migration, persistence, membership order and validation", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "rocket-metadata-"));
  const filename = path.join(folder, "test.db");
  let native = new DatabaseSync(filename);
  native.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE media_entries (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
      alternate_titles TEXT NOT NULL DEFAULT '[]', cover_uri TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '',
      creator TEXT NOT NULL DEFAULT '', creator_role TEXT NOT NULL DEFAULT '', release_year INTEGER,
      status TEXT NOT NULL DEFAULT 'Planned', note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
    );
    CREATE TABLE custom_lists (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE entry_lists (media_id TEXT REFERENCES media_entries(id) ON DELETE CASCADE, list_id TEXT REFERENCES custom_lists(id) ON DELETE CASCADE, PRIMARY KEY(media_id,list_id));
    CREATE TABLE journal_entries (id TEXT PRIMARY KEY, media_id TEXT REFERENCES media_entries(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO media_entries (id,type,title,note,updated_at) VALUES ('entry','Movie','Existing title','Keep my note','2026-01-01');
    INSERT INTO custom_lists VALUES ('list','Existing list','2026-01-01');
    INSERT INTO entry_lists VALUES ('entry','list');
    INSERT INTO media_entries (id,type,title,note,updated_at) VALUES ('other','Book','Other title','Other note','2025-01-01');
    INSERT INTO entry_lists VALUES ('other','list');
    INSERT INTO journal_entries VALUES ('journal','entry','Keep journal','2026-01-01');
  `);
  const open = () => openDatabase(native);
  try {
    let api = open();
    await api.database();
    let entry = (await api.getEntries())[0];
    assert.equal(entry.rating, null);
    assert.equal(entry.duration, null);
    assert.equal(entry.note, "Keep my note");
    assert.equal((await api.getLists())[0].icon, "list");
    assert.equal((await api.getLists())[0].type, "Movie");
    assert.deepEqual(Array.from(await api.getListEntryIds("list")), ["entry"]);
    const detached = (await api.getEntries()).find(
      (item) => item.id === "other",
    );
    assert.equal(detached.note, "Other note");
    assert.deepEqual(Array.from(detached.listIds), []);
    await api.saveEntry({
      ...entry,
      rating: 4,
      duration: 120,
      sourceUrl: "https://www.igdb.com/games/test-game",
    });
    await api.setEntryStatus("entry", "Completed");
    assert.equal((await api.getEntries())[0].rating, 4);
    await api.setListIcon("list", "star");
    const second = await api.saveEntry({
      ...model.emptyDraft(),
      type: "Movie",
      title: "Test movie",
      duration: 250,
      listIds: ["list"],
    });
    await api.reorderListEntries("list", [second, "entry"]);
    entry = (await api.getEntries()).find((item) => item.id === "entry");
    await api.saveEntry({ ...entry, title: "Edited" });
    assert.equal(
      (await api.getListEntryIds("list")).join(","),
      `${second},entry`,
    );
    await assert.rejects(api.setEntryRating("entry", 6), /Invalid rating/);
    await assert.rejects(
      api.saveEntry({ ...entry, duration: -1 }),
      /positive whole/,
    );
    await assert.rejects(api.saveEntry({ ...entry, rating: 2.5 }), /1–5/);
    await assert.rejects(
      api.setListIcon("list", "invalid"),
      /Invalid list icon/,
    );
    native.close();
    native = new DatabaseSync(filename);
    api = open();
    await api.database();
    entry = (await api.getEntries()).find((item) => item.id === "entry");
    assert.equal(entry.rating, 4);
    assert.equal(entry.duration, 120);
    assert.equal(entry.sourceUrl, "https://www.igdb.com/games/test-game");
    assert.equal((await api.getLists())[0].icon, "star");
    assert.equal((await api.getLists())[0].type, "Movie");
    assert.equal((await api.getJournal("entry"))[0].body, "Keep journal");
    await api.setEntryRating("entry", null);
    await api.saveEntry({ ...entry, type: "Game", rating: null, listIds: [] });
    assert.equal(
      (await api.getEntries()).find((item) => item.id === "entry").duration,
      null,
    );
    const listId = await api.createList(
      "New list",
      "Game",
      "Description",
      "Dusk",
      [],
      "heart",
    );
    assert.equal(
      (await api.getLists()).find((item) => item.id === listId).icon,
      "heart",
    );
  } finally {
    native.close();
    for (const name of fs.readdirSync(folder))
      fs.unlinkSync(path.join(folder, name));
    fs.rmdirSync(folder);
  }
});

test("typed lists enforce homogeneous memberships across all media types and write paths", async () => {
  const native = new DatabaseSync(":memory:");
  const api = openDatabase(native);
  try {
    const entries = new Map();
    const lists = new Map();
    for (const type of model.MEDIA_TYPES) {
      entries.set(
        type,
        await api.saveEntry({
          ...model.emptyDraft(),
          type,
          title: `Test ${type}`,
        }),
      );
      lists.set(
        type,
        await api.createList(`${type} shelf`, type, "", "Dusk", []),
      );
    }
    for (const type of model.MEDIA_TYPES) {
      const listId = lists.get(type);
      assert.equal(
        (await api.getLists()).find((list) => list.id === listId).type,
        type,
      );
      for (const entryType of model.MEDIA_TYPES) {
        if (type === entryType) {
          await api.setEntryListMembership(entries.get(type), listId, true);
        } else {
          await assert.rejects(
            api.setEntryListMembership(entries.get(entryType), listId, true),
            /Only .* titles/,
          );
        }
      }
      assert.deepEqual(Array.from(await api.getListEntryIds(listId)), [
        entries.get(type),
      ]);
    }
    const bookId = entries.get("Book");
    const bookList = lists.get("Book");
    const movieList = lists.get("Movie");
    const book = (await api.getEntries()).find((entry) => entry.id === bookId);
    await api.createJournalEntry(bookId, "Keep my journal");
    await assert.rejects(
      api.createList("Mixed shelf", "Book", "", "Dusk", [
        bookId,
        entries.get("Movie"),
      ]),
      /selected media type/,
    );
    assert.equal(
      (await api.getLists()).some((list) => list.name === "Mixed shelf"),
      false,
    );
    await assert.rejects(
      api.createList("Invalid", "Music", "", "Dusk", []),
      /Invalid list media type/,
    );
    await assert.rejects(
      api.saveEntry({
        ...book,
        title: "Must not persist",
        listIds: [movieList],
      }),
      /Only Movie/,
    );
    await assert.rejects(
      api.saveEntry({ ...book, type: "Movie" }),
      /Only Book/,
    );
    assert.equal(
      (await api.getEntries()).find((entry) => entry.id === bookId).title,
      book.title,
    );
    assert.deepEqual(Array.from(await api.getListEntryIds(bookList)), [bookId]);

    // SQL constraints protect callers that bypass the persistence helpers too.
    assert.throws(
      () =>
        native
          .prepare("INSERT INTO entry_lists (media_id, list_id) VALUES (?, ?)")
          .run(bookId, movieList),
      /selected media type/,
    );
    assert.throws(
      () =>
        native
          .prepare(
            "UPDATE entry_lists SET list_id = ? WHERE media_id = ? AND list_id = ?",
          )
          .run(movieList, bookId, bookList),
      /selected media type/,
    );
    assert.throws(
      () =>
        native
          .prepare("UPDATE media_entries SET type = 'Movie' WHERE id = ?")
          .run(bookId),
      /incompatible/,
    );
    assert.throws(
      () =>
        native
          .prepare("UPDATE custom_lists SET media_type = 'Movie' WHERE id = ?")
          .run(bookList),
      /cannot be changed/,
    );

    const populated = await api.createList(
      "Populated books",
      "Book",
      "",
      "Dusk",
      [bookId],
    );
    assert.deepEqual(Array.from(await api.getListEntryIds(populated)), [
      bookId,
    ]);
    const movieOrder = Array.from(await api.getListEntryIds(movieList));
    // An intentional type edit drops only the old memberships and appends to new ones.
    await api.saveEntry({
      ...book,
      type: "Movie",
      listIds: [movieList],
      note: "Keep my note",
      rating: 4,
    });
    assert.deepEqual(Array.from(await api.getListEntryIds(bookList)), []);
    assert.deepEqual(Array.from(await api.getListEntryIds(populated)), []);
    assert.deepEqual(Array.from(await api.getListEntryIds(movieList)), [
      ...movieOrder,
      bookId,
    ]);
    await api.deleteList(movieList);
    const saved = (await api.getEntries()).find((entry) => entry.id === bookId);
    assert.equal(saved.type, "Movie");
    assert.equal(saved.note, "Keep my note");
    assert.equal(saved.rating, 4);
    assert.equal((await api.getJournal(bookId))[0].body, "Keep my journal");
    assert.deepEqual(Array.from(saved.listIds), []);
    const remainingList = await api.createList(
      "Remaining movies",
      "Movie",
      "",
      "Dusk",
      [bookId],
    );
    await api.removeEntry(bookId);
    assert.equal(
      (await api.getEntries()).some((entry) => entry.id === bookId),
      false,
    );
    assert.deepEqual(Array.from(await api.getJournal(bookId)), []);
    assert.deepEqual(Array.from(await api.getListEntryIds(remainingList)), []);
    assert.equal((await api.getEntries()).length, model.MEDIA_TYPES.length - 1);
  } finally {
    native.close();
  }
});

test("changing draft type retains only compatible memberships without altering personal data", () => {
  const draft = {
    ...model.emptyDraft(),
    type: "Book",
    title: "Title",
    duration: 200,
    rating: 5,
    note: "Note",
    status: "Paused",
    listIds: ["books-b", "books-a"],
  };
  const lists = [
    { id: "books-a", type: "Book" },
    { id: "books-b", type: "Book" },
    { id: "movies", type: "Movie" },
  ];
  const sameType = model.changeDraftType(draft, "Book", lists);
  assert.deepEqual(Array.from(sameType.listIds), draft.listIds);
  assert.equal(sameType.duration, 200);
  const changed = model.changeDraftType(draft, "Movie", lists);
  assert.deepEqual(Array.from(changed.listIds), []);
  assert.equal(changed.duration, null);
  assert.equal(changed.creatorRole, "Director");
  for (const key of ["title", "rating", "note", "status"])
    assert.equal(changed[key], draft[key]);
  assert.deepEqual(draft.listIds, ["books-b", "books-a"]);
});

test("duplicate list copies metadata and ordered memberships, never library entries or personal data", async () => {
  const native = new DatabaseSync(":memory:");
  const api = openDatabase(native);
  try {
    const first = await api.saveEntry({
      ...model.emptyDraft(),
      type: "Book",
      title: "First",
      note: "Keep note",
      rating: 5,
    });
    const second = await api.saveEntry({
      ...model.emptyDraft(),
      type: "Book",
      title: "Second",
    });
    await api.createJournalEntry(first, "Keep journal");
    const sourceId = await api.createList(
      "A".repeat(36),
      "Book",
      "Description",
      "Sunset",
      [first, second],
      "heart",
    );
    await api.reorderListEntries(sourceId, [second, first]);
    const before = await api.getEntries();
    const copyId = await api.duplicateList(sourceId);
    const secondCopyId = await api.duplicateList(sourceId);
    const lists = await api.getLists();
    const source = lists.find((list) => list.id === sourceId);
    const copy = lists.find((list) => list.id === copyId);
    const secondCopy = lists.find((list) => list.id === secondCopyId);
    assert.notEqual(copy.id, source.id);
    for (const key of ["type", "description", "accent", "icon"])
      assert.equal(copy[key], source[key]);
    assert.match(copy.name, / \(copy\)$/);
    assert.match(secondCopy.name, / \(copy 2\)$/);
    assert.ok(copy.name.length <= 36 && secondCopy.name.length <= 36);
    assert.deepEqual(Array.from(await api.getListEntryIds(copyId)), [
      second,
      first,
    ]);
    assert.deepEqual(Array.from(await api.getListEntryIds(sourceId)), [
      second,
      first,
    ]);
    const after = await api.getEntries();
    assert.equal(after.length, before.length);
    for (const original of before) {
      const saved = after.find((entry) => entry.id === original.id);
      for (const key of ["title", "type", "note", "rating", "updatedAt"])
        assert.equal(saved[key], original[key]);
    }
    assert.equal((await api.getJournal(first)).length, 1);
    await api.setEntryListMembership(first, copyId, false);
    await api.reorderListEntries(secondCopyId, [first, second]);
    await api.deleteList(copyId);
    assert.deepEqual(Array.from(await api.getListEntryIds(sourceId)), [
      second,
      first,
    ]);
    assert.deepEqual(Array.from(await api.getListEntryIds(secondCopyId)), [
      first,
      second,
    ]);
    const empty = await api.createList("Empty", "Game", "", "Dusk", []);
    const emptyCopy = await api.duplicateList(empty);
    assert.deepEqual(Array.from(await api.getListEntryIds(emptyCopy)), []);
    assert.equal(
      (await api.getLists()).find((list) => list.id === emptyCopy).type,
      "Game",
    );
    const count = (await api.getLists()).length;
    await assert.rejects(api.duplicateList("missing"), /no longer exists/);
    assert.equal((await api.getLists()).length, count);
    const caseSource = await api.createList("Case", "Book", "", "Dusk", []);
    await api.createList("CASE (COPY)", "Book", "", "Dusk", []);
    const caseCopy = await api.duplicateList(caseSource);
    assert.equal(
      (await api.getLists()).find((list) => list.id === caseCopy).name,
      "Case (copy 2)",
    );
    const beforeFailure = (await api.getLists()).length;
    native.exec(
      "CREATE TRIGGER fail_copy BEFORE INSERT ON entry_lists BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;",
    );
    await assert.rejects(api.duplicateList(sourceId), /simulated failure/);
    assert.equal((await api.getLists()).length, beforeFailure);
    assert.deepEqual(Array.from(await api.getListEntryIds(sourceId)), [
      second,
      first,
    ]);
  } finally {
    native.close();
  }
});
