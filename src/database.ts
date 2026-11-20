import * as SQLite from "expo-sqlite";
import { BACKUP_VERSION, type LibraryBackup, validateBackup } from "./backup";
import type {
  CustomList,
  EntryDraft,
  JournalEntry,
  ListAccent,
  ListIcon,
  MediaEntry,
  MediaStatus,
  MediaType,
} from "./model";
import { LIST_ICONS, MEDIA_TYPES } from "./model";

let opened: SQLite.SQLiteDatabase | undefined;

type EntryRow = {
  id: string;
  type: MediaType;
  title: string;
  alternate_titles: string;
  cover_uri: string;
  summary: string;
  creator: string;
  creator_role: string;
  release_year: number | null;
  rating: number | null;
  duration: number | null;
  source_url: string;
  status: MediaStatus;
  note: string;
  updated_at: string;
};

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function database() {
  if (opened) return opened;

  const db = await SQLite.openDatabaseAsync("rocket.db");
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
  opened = db;
  return db;
}

function toEntry(row: EntryRow, listIds: string[]): MediaEntry {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    alternateTitles: JSON.parse(row.alternate_titles) as string[],
    coverUri: row.cover_uri,
    summary: row.summary,
    creator: row.creator,
    creatorRole: row.creator_role,
    releaseYear: row.release_year,
    rating: row.rating,
    duration: row.duration,
    sourceUrl: row.source_url,
    status: row.status,
    note: row.note,
    listIds,
    updatedAt: row.updated_at,
  };
}

export async function getEntries(): Promise<MediaEntry[]> {
  const db = await database();
  const [rows, links] = await Promise.all([
    db.getAllAsync<EntryRow>(
      "SELECT * FROM media_entries ORDER BY updated_at DESC",
    ),
    db.getAllAsync<{ media_id: string; list_id: string }>(
      "SELECT media_id, list_id FROM entry_lists",
    ),
  ]);
  const listMap = new Map<string, string[]>();
  for (const link of links) {
    listMap.set(link.media_id, [
      ...(listMap.get(link.media_id) ?? []),
      link.list_id,
    ]);
  }
  return rows.map((row) => toEntry(row, listMap.get(row.id) ?? []));
}

export async function getLists(): Promise<CustomList[]> {
  const db = await database();
  return db.getAllAsync<CustomList>(
    "SELECT id, name, media_type AS type, created_at AS createdAt, description, accent, icon FROM custom_lists ORDER BY name COLLATE NOCASE",
  );
}

export async function getListEntryIds(listId: string): Promise<string[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ media_id: string }>(
    "SELECT media_id FROM entry_lists WHERE list_id = ? ORDER BY sort_order ASC, rowid ASC",
    listId,
  );
  return rows.map((row) => row.media_id);
}

export async function reorderListEntries(listId: string, entryIds: string[]) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const [sortOrder, entryId] of entryIds.entries()) {
      await db.runAsync(
        "UPDATE entry_lists SET sort_order = ? WHERE list_id = ? AND media_id = ?",
        sortOrder,
        listId,
        entryId,
      );
    }
  });
}

export async function saveEntry(draft: EntryDraft): Promise<string> {
  if (
    draft.rating !== null &&
    (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5)
  )
    throw new Error("Rating must be 1–5 stars or unset.");
  if (
    draft.duration !== null &&
    (!Number.isSafeInteger(draft.duration) || draft.duration <= 0)
  )
    throw new Error("Duration must be a positive whole number or unset.");
  const db = await database();
  const id = draft.id ?? makeId();
  const updatedAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const listId of draft.listIds) {
      await assertListType(db, listId, draft.type);
    }
    const existingLinks = await db.getAllAsync<{ list_id: string }>(
      "SELECT list_id FROM entry_lists WHERE media_id = ?",
      id,
    );
    const existingListIds = new Set(existingLinks.map((link) => link.list_id));
    const requestedListIds = new Set(draft.listIds);
    // Remove deselected memberships before changing type; keep retained order intact.
    for (const listId of existingListIds) {
      if (!requestedListIds.has(listId)) {
        await db.runAsync(
          "DELETE FROM entry_lists WHERE media_id = ? AND list_id = ?",
          id,
          listId,
        );
      }
    }
    await db.runAsync(
      `INSERT INTO media_entries
       (id, type, title, alternate_titles, cover_uri, summary, creator, creator_role, release_year, status, note, updated_at, rating, duration, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type=excluded.type, title=excluded.title,
       alternate_titles=excluded.alternate_titles, cover_uri=excluded.cover_uri, summary=excluded.summary,
       creator=excluded.creator, creator_role=excluded.creator_role, release_year=excluded.release_year,
       status=excluded.status, note=excluded.note, updated_at=excluded.updated_at, rating=excluded.rating, duration=excluded.duration, source_url=excluded.source_url`,
      id,
      draft.type,
      draft.title.trim(),
      JSON.stringify(draft.alternateTitles),
      draft.coverUri.trim(),
      draft.summary.trim(),
      draft.creator.trim(),
      draft.creatorRole.trim(),
      draft.releaseYear,
      draft.status,
      draft.note.trim(),
      updatedAt,
      draft.rating,
      draft.type === "Game" ? null : draft.duration,
      draft.sourceUrl,
    );
    for (const listId of draft.listIds) {
      if (!existingListIds.has(listId)) {
        await db.runAsync(
          `INSERT OR IGNORE INTO entry_lists (media_id, list_id, sort_order)
           VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM entry_lists WHERE list_id = ?), 0))`,
          id,
          listId,
          listId,
        );
      }
    }
  });
  return id;
}

export async function createList(
  name: string,
  type: MediaType,
  description: string,
  accent: ListAccent,
  entryIds: string[],
  icon: ListIcon = "list",
) {
  if (!MEDIA_TYPES.includes(type)) throw new Error("Invalid list media type.");
  if (!LIST_ICONS.some((choice) => choice.name === icon))
    throw new Error("Invalid list icon.");
  const db = await database();
  const id = makeId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO custom_lists (id, name, media_type, created_at, description, accent, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      name.trim(),
      type,
      new Date().toISOString(),
      description.trim(),
      accent,
      icon,
    );
    for (const entryId of entryIds) {
      await db.runAsync(
        "INSERT INTO entry_lists (media_id, list_id, sort_order) VALUES (?, ?, ?)",
        entryId,
        id,
        entryIds.indexOf(entryId),
      );
    }
  });
  return id;
}

export async function deleteList(id: string) {
  const db = await database();
  await db.runAsync("DELETE FROM custom_lists WHERE id = ?", id);
}

export async function duplicateList(sourceId: string): Promise<string> {
  const db = await database();
  const id = makeId();
  await db.withTransactionAsync(async () => {
    const source = await db.getFirstAsync<CustomList>(
      "SELECT id, name, media_type AS type, created_at AS createdAt, description, accent, icon FROM custom_lists WHERE id = ?",
      sourceId,
    );
    if (!source) throw new Error("This list no longer exists.");
    const names = new Set(
      (
        await db.getAllAsync<{ name: string }>("SELECT name FROM custom_lists")
      ).map((list) => list.name.toLocaleLowerCase()),
    );
    let name = "";
    for (let copy = 1; ; copy += 1) {
      const suffix = copy === 1 ? " (copy)" : ` (copy ${copy})`;
      name = source.name.slice(0, 36 - suffix.length).trimEnd() + suffix;
      if (!names.has(name.toLocaleLowerCase())) break;
    }
    await db.runAsync(
      "INSERT INTO custom_lists (id, name, media_type, created_at, description, accent, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      name,
      source.type,
      new Date().toISOString(),
      source.description,
      source.accent,
      source.icon,
    );
    // Copy memberships, not titles or personal data. Keep the source's exact order.
    await db.runAsync(
      "INSERT INTO entry_lists (media_id, list_id, sort_order) SELECT media_id, ?, sort_order FROM entry_lists WHERE list_id = ? ORDER BY sort_order, rowid",
      id,
      sourceId,
    );
  });
  return id;
}

export async function setListIcon(id: string, icon: ListIcon) {
  if (!LIST_ICONS.some((choice) => choice.name === icon))
    throw new Error("Invalid list icon.");
  const db = await database();
  await db.runAsync("UPDATE custom_lists SET icon = ? WHERE id = ?", icon, id);
}

export async function setEntryRating(id: string, rating: number | null) {
  if (
    rating !== null &&
    (!Number.isInteger(rating) || rating < 1 || rating > 5)
  )
    throw new Error("Invalid rating.");
  const db = await database();
  await db.runAsync(
    "UPDATE media_entries SET rating = ?, updated_at = ? WHERE id = ?",
    rating,
    new Date().toISOString(),
    id,
  );
}

export async function setEntryStatus(id: string, status: MediaStatus) {
  const db = await database();
  await db.runAsync(
    "UPDATE media_entries SET status = ?, updated_at = ? WHERE id = ?",
    status,
    new Date().toISOString(),
    id,
  );
}

export async function setEntryListMembership(
  mediaId: string,
  listId: string,
  included: boolean,
) {
  const db = await database();
  if (included) {
    const entry = await db.getFirstAsync<{ type: MediaType }>(
      "SELECT type FROM media_entries WHERE id = ?",
      mediaId,
    );
    if (!entry) throw new Error("This title is no longer in your library.");
    await assertListType(db, listId, entry.type);
    await db.runAsync(
      `INSERT OR IGNORE INTO entry_lists (media_id, list_id, sort_order)
       VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM entry_lists WHERE list_id = ?), 0))`,
      mediaId,
      listId,
      listId,
    );
  } else {
    await db.runAsync(
      "DELETE FROM entry_lists WHERE media_id = ? AND list_id = ?",
      mediaId,
      listId,
    );
  }
}

async function assertListType(
  db: SQLite.SQLiteDatabase,
  listId: string,
  type: MediaType,
) {
  const list = await db.getFirstAsync<{ media_type: MediaType }>(
    "SELECT media_type FROM custom_lists WHERE id = ?",
    listId,
  );
  if (!list) throw new Error("This list no longer exists.");
  if (list.media_type !== type)
    throw new Error(
      `Only ${list.media_type} titles can be added to this list.`,
    );
}

export async function getJournal(mediaId: string): Promise<JournalEntry[]> {
  const db = await database();
  return db.getAllAsync<JournalEntry>(
    "SELECT id, media_id AS mediaId, body, created_at AS createdAt FROM journal_entries WHERE media_id = ? ORDER BY created_at DESC",
    mediaId,
  );
}

export async function createJournalEntry(mediaId: string, body: string) {
  const db = await database();
  await db.runAsync(
    "INSERT INTO journal_entries (id, media_id, body, created_at) VALUES (?, ?, ?, ?)",
    makeId(),
    mediaId,
    body.trim(),
    new Date().toISOString(),
  );
}

export async function removeEntry(id: string) {
  const db = await database();
  await db.runAsync("DELETE FROM media_entries WHERE id = ?", id);
}

export async function exportLibraryBackup(): Promise<LibraryBackup> {
  const db = await database();
  let backup: LibraryBackup | undefined;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const rows = await txn.getAllAsync<EntryRow>(
      "SELECT * FROM media_entries ORDER BY updated_at DESC, rowid",
    );
    const lists = await txn.getAllAsync<CustomList>(
      "SELECT id, name, media_type AS type, created_at AS createdAt, description, accent, icon FROM custom_lists ORDER BY name COLLATE NOCASE",
    );
    const links = await txn.getAllAsync<{ media_id: string; list_id: string }>(
      "SELECT media_id, list_id FROM entry_lists ORDER BY sort_order, rowid",
    );
    const journals = await txn.getAllAsync<JournalEntry>(
      "SELECT id, media_id AS mediaId, body, created_at AS createdAt FROM journal_entries ORDER BY created_at DESC, rowid",
    );
    const order = new Map<string, string[]>();
    for (const link of links) {
      const entryIds = order.get(link.list_id);
      if (entryIds) entryIds.push(link.media_id);
      else order.set(link.list_id, [link.media_id]);
    }
    backup = validateBackup({
      format: "rocket-backup",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      entries: rows.map((row) => toEntry(row, [])),
      lists: lists.map((list) => ({
        ...list,
        entryIds: order.get(list.id) ?? [],
      })),
      journals,
    });
  });
  if (!backup) throw new Error("Could not read the library snapshot.");
  return backup;
}

export async function replaceLibraryFromBackup(input: LibraryBackup) {
  const backup = validateBackup(input);
  const db = await database();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // The exclusive connection has its own foreign_keys setting. Delete children
    // explicitly and check integrity before committing instead of relying on cascades.
    await txn.execAsync(`
      DELETE FROM entry_lists;
      DELETE FROM journal_entries;
      DELETE FROM custom_lists;
      DELETE FROM media_entries;
    `);
    for (const entry of backup.entries) {
      await txn.runAsync(
        `INSERT INTO media_entries
         (id, type, title, alternate_titles, cover_uri, summary, creator, creator_role, release_year, status, note, updated_at, rating, duration, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.id,
        entry.type,
        entry.title,
        JSON.stringify(entry.alternateTitles),
        entry.coverUri,
        entry.summary,
        entry.creator,
        entry.creatorRole,
        entry.releaseYear,
        entry.status,
        entry.note,
        entry.updatedAt,
        entry.rating,
        entry.duration,
        entry.sourceUrl,
      );
    }
    for (const list of backup.lists) {
      await txn.runAsync(
        "INSERT INTO custom_lists (id, name, media_type, created_at, description, accent, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
        list.id,
        list.name,
        list.type,
        list.createdAt,
        list.description,
        list.accent,
        list.icon,
      );
      for (const [position, entryId] of list.entryIds.entries()) {
        await txn.runAsync(
          "INSERT INTO entry_lists (media_id, list_id, sort_order) VALUES (?, ?, ?)",
          entryId,
          list.id,
          position,
        );
      }
    }
    for (const journal of backup.journals) {
      await txn.runAsync(
        "INSERT INTO journal_entries (id, media_id, body, created_at) VALUES (?, ?, ?, ?)",
        journal.id,
        journal.mediaId,
        journal.body,
        journal.createdAt,
      );
    }
    if (await txn.getFirstAsync("PRAGMA foreign_key_check")) {
      throw new Error("Restored library contains invalid references.");
    }
  });
}
