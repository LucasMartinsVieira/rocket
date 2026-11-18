import * as SQLite from "expo-sqlite";
import { LIST_ICONS } from "./model";
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
    "SELECT id, name, created_at AS createdAt, description, accent, icon FROM custom_lists ORDER BY name COLLATE NOCASE",
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
    const existingLinks = await db.getAllAsync<{ list_id: string }>(
      "SELECT list_id FROM entry_lists WHERE media_id = ?",
      id,
    );
    const existingListIds = new Set(existingLinks.map((link) => link.list_id));
    const requestedListIds = new Set(draft.listIds);
    for (const listId of existingListIds) {
      if (!requestedListIds.has(listId)) {
        await db.runAsync(
          "DELETE FROM entry_lists WHERE media_id = ? AND list_id = ?",
          id,
          listId,
        );
      }
    }
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
  description: string,
  accent: ListAccent,
  entryIds: string[],
  icon: ListIcon = "list",
) {
  if (!LIST_ICONS.some((choice) => choice.name === icon))
    throw new Error("Invalid list icon.");
  const db = await database();
  const id = makeId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO custom_lists (id, name, created_at, description, accent, icon) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      name.trim(),
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
