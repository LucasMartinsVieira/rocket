import { getDatabase } from "../database";
import type { JournalEntry } from "../model";
import { makeId } from "./makeId";

async function getJournal(mediaId: string): Promise<JournalEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<JournalEntry>(
    "SELECT id, media_id AS mediaId, body, created_at AS createdAt FROM journal_entries WHERE media_id = ? ORDER BY created_at DESC",
    mediaId,
  );
}

async function createJournalEntry(mediaId: string, body: string) {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO journal_entries (id, media_id, body, created_at) VALUES (?, ?, ?, ?)",
    makeId(),
    mediaId,
    body.trim(),
    new Date().toISOString(),
  );
}

export const journalRepository = {
  listForEntry: getJournal,
  create: createJournalEntry,
};
