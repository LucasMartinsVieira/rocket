import { getDatabase } from "../database";
import {
  type EntryDraft,
  entryDateError,
  type MediaEntry,
  type MediaStatus,
} from "../model";
import { type EntryRow, toEntry } from "./entryRow";
import { makeId } from "./makeId";
import {
  appendMembership,
  assertListType,
  removeMembership,
} from "./memberships";

async function getEntries(): Promise<MediaEntry[]> {
  const db = await getDatabase();
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

async function saveEntry(draft: EntryDraft): Promise<string> {
  const dateError = entryDateError(draft.startDate, draft.endDate);
  if (dateError) throw new Error(dateError);
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
  const db = await getDatabase();
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
        await removeMembership(db, id, listId);
      }
    }
    await db.runAsync(
      `INSERT INTO media_entries
       (id, type, title, alternate_titles, cover_uri, summary, creator, creator_role, release_year, status, note, updated_at, rating, duration, source_url, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type=excluded.type, title=excluded.title,
       alternate_titles=excluded.alternate_titles, cover_uri=excluded.cover_uri, summary=excluded.summary,
       creator=excluded.creator, creator_role=excluded.creator_role, release_year=excluded.release_year,
       status=excluded.status, note=excluded.note, updated_at=excluded.updated_at, rating=excluded.rating, duration=excluded.duration, source_url=excluded.source_url,
       start_date=excluded.start_date, end_date=excluded.end_date`,
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
      draft.startDate,
      draft.endDate,
    );
    for (const listId of draft.listIds) {
      if (!existingListIds.has(listId)) {
        await appendMembership(db, id, listId);
      }
    }
  });
  return id;
}

async function setEntryRating(id: string, rating: number | null) {
  if (
    rating !== null &&
    (!Number.isInteger(rating) || rating < 1 || rating > 5)
  )
    throw new Error("Invalid rating.");
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE media_entries SET rating = ?, updated_at = ? WHERE id = ?",
    rating,
    new Date().toISOString(),
    id,
  );
}

async function setEntryStatus(id: string, status: MediaStatus) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE media_entries SET status = ?, updated_at = ? WHERE id = ?",
    status,
    new Date().toISOString(),
    id,
  );
}

async function removeEntry(id: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM media_entries WHERE id = ?", id);
}

export const entryRepository = {
  list: getEntries,
  save: saveEntry,
  setRating: setEntryRating,
  setStatus: setEntryStatus,
  remove: removeEntry,
};
