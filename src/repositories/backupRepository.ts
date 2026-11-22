import { BACKUP_VERSION, type LibraryBackup, validateBackup } from "../backup";
import { getDatabase } from "../database";
import type { CustomList, JournalEntry } from "../model";
import { type EntryRow, toEntry } from "./entryRow";

async function exportLibraryBackup(): Promise<LibraryBackup> {
  const db = await getDatabase();
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

async function replaceLibraryFromBackup(input: LibraryBackup) {
  const backup = validateBackup(input);
  const db = await getDatabase();
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
         (id, type, title, alternate_titles, cover_uri, summary, creator, creator_role, release_year, status, note, updated_at, rating, duration, source_url, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        entry.startDate,
        entry.endDate,
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

export const backupRepository = {
  exportSnapshot: exportLibraryBackup,
  replaceLibrary: replaceLibraryFromBackup,
};
