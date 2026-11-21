import {
  type CustomList,
  entryDateError,
  type JournalEntry,
  LIST_ACCENTS,
  LIST_ICONS,
  MEDIA_TYPES,
  type MediaEntry,
  STATUSES,
} from "./model";

export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

export type LibraryBackup = {
  format: "rocket-backup";
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  entries: Omit<MediaEntry, "listIds">[];
  lists: (CustomList & { entryIds: string[] })[];
  journals: JournalEntry[];
};

export class BackupFileError extends Error {
  constructor(public readonly kind: "invalid" | "version" | "size") {
    super(
      kind === "version"
        ? "This backup uses a version Rocket cannot restore."
        : kind === "size"
          ? "Choose a Rocket backup no larger than 16 MB."
          : "Choose a valid Rocket JSON backup. This file is incomplete or contains invalid library data.",
    );
  }
}

function invalid(): never {
  throw new BackupFileError("invalid");
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalid();
  return value;
}
function text(value: unknown, required = false): string {
  if (typeof value !== "string" || (required && !value.trim())) invalid();
  return value;
}
function id(value: unknown): string {
  const key = text(value, true);
  if (key.length > 128 || key.includes("\0")) invalid();
  return key;
}
function date(value: unknown): string {
  const stamp = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)) invalid();
  const parsed = new Date(stamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== stamp)
    invalid();
  return stamp;
}
function integer(value: unknown, max: number): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > max
  )
    invalid();
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  const match = choices.find((option) => option === value);
  if (match === undefined) invalid();
  return match;
}
function unique(keys: Iterable<string>) {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) invalid();
    seen.add(key);
  }
}
const icons = LIST_ICONS.map((icon) => icon.name);

export function validateBackup(value: unknown): LibraryBackup {
  const root = object(value);
  if (
    root.format !== "rocket-backup" ||
    typeof root.version !== "number" ||
    !Number.isSafeInteger(root.version)
  )
    invalid();
  if (root.version !== 1 && root.version !== BACKUP_VERSION)
    throw new BackupFileError("version");
  const hasEntryDates = root.version === BACKUP_VERSION;
  const exportedAt = date(root.exportedAt);

  const entries = array(root.entries).map((value) => {
    const entry = object(value);
    const type = choice(entry.type, MEDIA_TYPES);
    const duration = integer(entry.duration, Number.MAX_SAFE_INTEGER);
    if (type === "Game" && duration !== null) invalid();
    const startDate =
      !hasEntryDates || entry.startDate === null ? null : text(entry.startDate);
    const endDate =
      !hasEntryDates || entry.endDate === null ? null : text(entry.endDate);
    if (entryDateError(startDate, endDate)) invalid();
    return {
      id: id(entry.id),
      type,
      duration,
      title: text(entry.title, true),
      alternateTitles: array(entry.alternateTitles).map((title) => text(title)),
      coverUri: text(entry.coverUri),
      summary: text(entry.summary),
      creator: text(entry.creator),
      creatorRole: text(entry.creatorRole),
      releaseYear: integer(entry.releaseYear, 9999),
      startDate,
      endDate,
      rating: integer(entry.rating, 5),
      sourceUrl: text(entry.sourceUrl),
      status: choice(entry.status, STATUSES),
      note: text(entry.note),
      updatedAt: date(entry.updatedAt),
    };
  });
  unique(entries.map((entry) => entry.id));
  const entryTypes = new Map(entries.map((entry) => [entry.id, entry.type]));

  const lists = array(root.lists).map((value) => {
    const list = object(value);
    const type = choice(list.type, MEDIA_TYPES);
    const entryIds = array(list.entryIds).map(id);
    unique(entryIds);
    if (entryIds.some((entryId) => entryTypes.get(entryId) !== type)) invalid();
    const name = text(list.name, true);
    if (name.includes("\0")) invalid();
    return {
      id: id(list.id),
      name,
      type,
      entryIds,
      createdAt: date(list.createdAt),
      description: text(list.description),
      accent: choice(list.accent, LIST_ACCENTS),
      icon: choice(list.icon, icons),
    };
  });
  unique(lists.map((list) => list.id));
  // Match SQLite's built-in NOCASE collation (ASCII only).
  unique(
    lists.map((list) =>
      list.name.replace(/[A-Z]/g, (letter) => letter.toLowerCase()),
    ),
  );

  const journals = array(root.journals).map((value) => {
    const journal = object(value);
    const mediaId = id(journal.mediaId);
    if (!entryTypes.has(mediaId)) invalid();
    return {
      id: id(journal.id),
      mediaId,
      body: text(journal.body, true),
      createdAt: date(journal.createdAt),
    };
  });
  unique(journals.map((journal) => journal.id));
  return {
    format: "rocket-backup",
    version: BACKUP_VERSION,
    exportedAt,
    entries,
    lists,
    journals,
  };
}

export function parseBackup(json: string): LibraryBackup {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    invalid();
  }
  return validateBackup(value);
}

export function snapshotCounts(backup: LibraryBackup) {
  return {
    titles: backup.entries.length,
    lists: backup.lists.length,
    journals: backup.journals.length,
    ratings: backup.entries.filter((entry) => entry.rating !== null).length,
  };
}

export function restoredLibrary(backup: LibraryBackup) {
  const memberships = new Map<string, string[]>();
  for (const list of backup.lists) {
    for (const id of list.entryIds) {
      const ids = memberships.get(id);
      if (ids) ids.push(list.id);
      else memberships.set(id, [list.id]);
    }
  }
  return {
    entries: backup.entries
      .map((entry) => ({ ...entry, listIds: memberships.get(entry.id) ?? [] }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    lists: backup.lists
      .map(({ entryIds, ...list }) => list)
      .sort((a, b) => a.name.localeCompare(b.name)),
    order: Object.fromEntries(
      backup.lists.map((list) => [list.id, list.entryIds]),
    ),
  };
}
