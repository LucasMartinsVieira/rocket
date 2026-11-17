const assert = require("node:assert/strict");
const fs = require("node:fs");
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
  const folder = fs.mkdtempSync("/tmp/opencode/rocket-metadata-");
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
    INSERT INTO journal_entries VALUES ('journal','entry','Keep journal','2026-01-01');
  `);
  const open = () =>
    load("database.ts", {
      "./model": model,
      "expo-sqlite": {
        openDatabaseAsync: async () => ({
          execAsync: async (sql) => native.exec(sql),
          getAllAsync: async (sql, ...params) =>
            native.prepare(sql).all(...params),
          runAsync: async (sql, ...params) =>
            native.prepare(sql).run(...params),
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
        }),
      },
    });
  try {
    let api = open();
    await api.database();
    let entry = (await api.getEntries())[0];
    assert.equal(entry.rating, null);
    assert.equal(entry.duration, null);
    assert.equal(entry.note, "Keep my note");
    assert.equal((await api.getLists())[0].icon, "list");
    await api.saveEntry({ ...entry, rating: 4, duration: 120 });
    await api.setEntryStatus("entry", "Completed");
    assert.equal((await api.getEntries())[0].rating, 4);
    await api.setListIcon("list", "star");
    const second = await api.saveEntry({
      ...model.emptyDraft(),
      type: "Book",
      title: "Test book",
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
    assert.equal((await api.getLists())[0].icon, "star");
    assert.equal((await api.getJournal("entry"))[0].body, "Keep journal");
    await api.setEntryRating("entry", null);
    await api.saveEntry({ ...entry, type: "Game", rating: null });
    assert.equal(
      (await api.getEntries()).find((item) => item.id === "entry").duration,
      null,
    );
    const listId = await api.createList(
      "New list",
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
