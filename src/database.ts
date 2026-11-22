import * as SQLite from "expo-sqlite";

let opening: Promise<SQLite.SQLiteDatabase> | undefined;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // All repositories wait for the same connection and migrations.
  opening ??= openDatabase().catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

async function openDatabase() {
  const db = await SQLite.openDatabaseAsync("rocket.db");
  try {
    await migrateDatabase(db);
    return db;
  } catch (error) {
    // Preserve the initialization error even if cleaning up the handle fails.
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function migrateDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS media_entries (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      alternate_titles TEXT NOT NULL DEFAULT '[]',
      cover_uri TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      creator TEXT NOT NULL DEFAULT '',
      creator_role TEXT NOT NULL DEFAULT '',
      release_year INTEGER,
      status TEXT NOT NULL DEFAULT 'Planned',
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_lists (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      media_type TEXT NOT NULL CHECK (media_type IN ('Anime', 'Manga', 'Movie', 'Book', 'Game')),
      created_at TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT 'Dusk'
    );
    CREATE TABLE IF NOT EXISTS entry_lists (
      media_id TEXT NOT NULL REFERENCES media_entries(id) ON DELETE CASCADE,
      list_id TEXT NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (media_id, list_id)
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY NOT NULL,
      media_id TEXT NOT NULL REFERENCES media_entries(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const listColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(custom_lists)",
  );
  const existingColumns = new Set(listColumns.map((column) => column.name));
  if (!existingColumns.has("description")) {
    await db.execAsync(
      "ALTER TABLE custom_lists ADD COLUMN description TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!existingColumns.has("accent")) {
    await db.execAsync(
      "ALTER TABLE custom_lists ADD COLUMN accent TEXT NOT NULL DEFAULT 'Dusk'",
    );
  }
  if (!existingColumns.has("icon")) {
    await db.execAsync(
      "ALTER TABLE custom_lists ADD COLUMN icon TEXT NOT NULL DEFAULT 'list'",
    );
  }
  const mediaColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(media_entries)",
  );
  if (!mediaColumns.some((column) => column.name === "source_url")) {
    await db.execAsync(
      "ALTER TABLE media_entries ADD COLUMN source_url TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!mediaColumns.some((column) => column.name === "rating")) {
    await db.execAsync(
      "ALTER TABLE media_entries ADD COLUMN rating INTEGER CHECK (rating IS NULL OR (typeof(rating) = 'integer' AND rating BETWEEN 1 AND 5))",
    );
  }
  if (!mediaColumns.some((column) => column.name === "duration")) {
    await db.execAsync(
      "ALTER TABLE media_entries ADD COLUMN duration INTEGER CHECK (duration IS NULL OR (typeof(duration) = 'integer' AND duration > 0))",
    );
  }
  if (!mediaColumns.some((column) => column.name === "start_date")) {
    await db.execAsync("ALTER TABLE media_entries ADD COLUMN start_date TEXT");
  }
  if (!mediaColumns.some((column) => column.name === "end_date")) {
    await db.execAsync("ALTER TABLE media_entries ADD COLUMN end_date TEXT");
  }
  const entryListColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(entry_lists)",
  );
  if (!entryListColumns.some((column) => column.name === "sort_order")) {
    await db.execAsync(
      "ALTER TABLE entry_lists ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!existingColumns.has("media_type")) {
    // Convert once to typed lists, using the first ordered member (Anime if empty).
    // Detach mismatched memberships only; never delete their library entries.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE custom_lists ADD COLUMN media_type TEXT NOT NULL DEFAULT 'Anime'
          CHECK (media_type IN ('Anime', 'Manga', 'Movie', 'Book', 'Game'));
        UPDATE custom_lists SET media_type = COALESCE((
          SELECT media_entries.type FROM entry_lists
          JOIN media_entries ON media_entries.id = entry_lists.media_id
          WHERE entry_lists.list_id = custom_lists.id
          ORDER BY entry_lists.sort_order, entry_lists.rowid LIMIT 1
        ), 'Anime');
        DELETE FROM entry_lists WHERE EXISTS (
          SELECT 1 FROM media_entries JOIN custom_lists
          ON custom_lists.id = entry_lists.list_id
          WHERE media_entries.id = entry_lists.media_id
          AND media_entries.type <> custom_lists.media_type
        );
      `);
    });
  }
  await db.execAsync(`
    CREATE TRIGGER IF NOT EXISTS entry_list_type_insert
    BEFORE INSERT ON entry_lists
    WHEN (SELECT type FROM media_entries WHERE id = NEW.media_id)
      <> (SELECT media_type FROM custom_lists WHERE id = NEW.list_id)
    BEGIN SELECT RAISE(ABORT, 'Lists can only contain their selected media type.'); END;
    CREATE TRIGGER IF NOT EXISTS entry_list_type_update
    BEFORE UPDATE OF media_id, list_id ON entry_lists
    WHEN (SELECT type FROM media_entries WHERE id = NEW.media_id)
      <> (SELECT media_type FROM custom_lists WHERE id = NEW.list_id)
    BEGIN SELECT RAISE(ABORT, 'Lists can only contain their selected media type.'); END;
    CREATE TRIGGER IF NOT EXISTS media_entry_type_update
    BEFORE UPDATE OF type ON media_entries
    WHEN EXISTS (
      SELECT 1 FROM entry_lists JOIN custom_lists ON custom_lists.id = entry_lists.list_id
      WHERE entry_lists.media_id = OLD.id AND custom_lists.media_type <> NEW.type
    )
    BEGIN SELECT RAISE(ABORT, 'Remove incompatible list memberships before changing media type.'); END;
    CREATE TRIGGER IF NOT EXISTS custom_list_type_update
    BEFORE UPDATE OF media_type ON custom_lists WHEN NEW.media_type <> OLD.media_type
    BEGIN SELECT RAISE(ABORT, 'A list media type cannot be changed.'); END;
  `);
}
