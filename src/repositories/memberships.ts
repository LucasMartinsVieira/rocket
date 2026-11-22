import type { SQLiteDatabase } from "expo-sqlite";
import type { MediaType } from "../model";

export async function assertListType(
  db: SQLiteDatabase,
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

// Use the caller's connection so entry saves can keep membership changes atomic.
export async function appendMembership(
  db: SQLiteDatabase,
  mediaId: string,
  listId: string,
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO entry_lists (media_id, list_id, sort_order)
     VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM entry_lists WHERE list_id = ?), 0))`,
    mediaId,
    listId,
    listId,
  );
}

export async function removeMembership(
  db: SQLiteDatabase,
  mediaId: string,
  listId: string,
) {
  await db.runAsync(
    "DELETE FROM entry_lists WHERE media_id = ? AND list_id = ?",
    mediaId,
    listId,
  );
}
