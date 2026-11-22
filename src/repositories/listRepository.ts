import { getDatabase } from "../database";
import {
  type CustomList,
  LIST_ACCENTS,
  LIST_ICONS,
  type ListAccent,
  type ListIcon,
  MEDIA_TYPES,
  type MediaType,
} from "../model";
import { makeId } from "./makeId";
import {
  appendMembership,
  assertListType,
  removeMembership,
} from "./memberships";

async function getLists(): Promise<CustomList[]> {
  const db = await getDatabase();
  return db.getAllAsync<CustomList>(
    "SELECT id, name, media_type AS type, created_at AS createdAt, description, accent, icon FROM custom_lists ORDER BY name COLLATE NOCASE",
  );
}

async function getListEntryIds(listId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ media_id: string }>(
    "SELECT media_id FROM entry_lists WHERE list_id = ? ORDER BY sort_order ASC, rowid ASC",
    listId,
  );
  return rows.map((row) => row.media_id);
}

async function reorderListEntries(listId: string, entryIds: string[]) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const members = await db.getAllAsync<{ media_id: string }>(
      "SELECT media_id FROM entry_lists WHERE list_id = ?",
      listId,
    );
    const requested = new Set(entryIds);
    if (
      requested.size !== entryIds.length ||
      members.length !== entryIds.length ||
      members.some(({ media_id }) => !requested.has(media_id))
    )
      throw new Error("List membership changed. Reopen the reorder editor.");
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

async function createList(
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
  const db = await getDatabase();
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

async function deleteList(id: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM custom_lists WHERE id = ?", id);
}

async function duplicateList(sourceId: string): Promise<string> {
  const db = await getDatabase();
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

async function setListIcon(id: string, icon: ListIcon) {
  if (!LIST_ICONS.some((choice) => choice.name === icon))
    throw new Error("Invalid list icon.");
  const db = await getDatabase();
  await db.runAsync("UPDATE custom_lists SET icon = ? WHERE id = ?", icon, id);
}

async function setListAccent(id: string, accent: ListAccent) {
  if (!LIST_ACCENTS.includes(accent)) throw new Error("Invalid list accent.");
  const db = await getDatabase();
  const result = await db.runAsync(
    "UPDATE custom_lists SET accent = ? WHERE id = ?",
    accent,
    id,
  );
  if (!result.changes) throw new Error("This list no longer exists.");
}

async function setEntryListMembership(
  mediaId: string,
  listId: string,
  included: boolean,
) {
  const db = await getDatabase();
  if (included) {
    const entry = await db.getFirstAsync<{ type: MediaType }>(
      "SELECT type FROM media_entries WHERE id = ?",
      mediaId,
    );
    if (!entry) throw new Error("This title is no longer in your library.");
    await assertListType(db, listId, entry.type);
    await appendMembership(db, mediaId, listId);
  } else {
    await removeMembership(db, mediaId, listId);
  }
}

export const listRepository = {
  list: getLists,
  getEntryIds: getListEntryIds,
  reorderEntries: reorderListEntries,
  create: createList,
  remove: deleteList,
  duplicate: duplicateList,
  setIcon: setListIcon,
  setAccent: setListAccent,
  setMembership: setEntryListMembership,
};
