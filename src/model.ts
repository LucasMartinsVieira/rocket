export const MEDIA_TYPES = [
  "Anime",
  "Manga",
  "Movie",
  "TV Show",
  "Book",
  "Game",
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const STATUSES = [
  "Planned",
  "In Progress",
  "Completed",
  "Paused",
  "Dropped",
  "Revisiting",
] as const;
export type MediaStatus = (typeof STATUSES)[number];

export type MediaEntry = {
  id: string;
  type: MediaType;
  title: string;
  alternateTitles: string[];
  coverUri: string;
  summary: string;
  creator: string;
  creatorRole: string;
  releaseYear: number | null;
  startDate: string | null;
  endDate: string | null;
  rating: number | null;
  duration: number | null;
  sourceUrl: string;
  status: MediaStatus;
  note: string;
  listIds: string[];
  updatedAt: string;
};

export type EntryDraft = Omit<MediaEntry, "id" | "updatedAt"> & { id?: string };

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function entryDateError(
  start: string | null,
  end: string | null,
): string | null {
  if (start !== null && !isCalendarDate(start))
    return "Start date must be a valid date in YYYY-MM-DD format.";
  if (end !== null && !isCalendarDate(end))
    return "End date must be a valid date in YYYY-MM-DD format.";
  if (start !== null && end !== null && end < start)
    return "End date must be on or after the start date.";
  return null;
}

export function formatCalendarDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const LIST_ACCENTS = [
  "Dusk",
  "Sunset",
  "Silver",
  "Amber",
  "Alert",
] as const;
export type ListAccent = (typeof LIST_ACCENTS)[number];
export const LIST_ICONS = [
  { name: "list", label: "List" },
  { name: "book", label: "Book" },
  { name: "bookImage", label: "Manga" },
  { name: "clapperboard", label: "Movie" },
  { name: "gamepad", label: "Game" },
  { name: "library", label: "Library" },
  { name: "star", label: "Star" },
  { name: "heart", label: "Heart" },
  { name: "bookmark", label: "Bookmark" },
  { name: "clock", label: "Clock" },
  { name: "trophy", label: "Trophy" },
  { name: "flame", label: "Flame" },
  { name: "moon", label: "Moon" },
  { name: "music", label: "Music" },
  { name: "globe", label: "Globe" },
  { name: "sparkles", label: "Sparkles" },
] as const;
export type ListIcon = (typeof LIST_ICONS)[number]["name"];
export const DURATION_LABEL: Record<MediaType, string | null> = {
  Book: "Pages",
  Manga: "Chapters",
  Movie: "Runtime (minutes)",
  "TV Show": "Seasons",
  Anime: "Episodes",
  Game: null,
};
export function formatDuration(
  type: MediaType,
  value: number | null,
): string | null {
  if (!value || type === "Game") return null;
  if (type === "TV Show")
    return `${value} ${value === 1 ? "season" : "seasons"}`;
  const unit =
    type === "Movie"
      ? "min"
      : type === "Book"
        ? value === 1
          ? "page"
          : "pages"
        : type === "Manga"
          ? value === 1
            ? "chapter"
            : "chapters"
          : value === 1
            ? "episode"
            : "episodes";
  return `${value} ${unit}`;
}
export const LIST_ACCENT_COLOR: Record<ListAccent, string> = {
  Dusk: "#7C3AED",
  Sunset: "#EA6B00",
  Silver: "#C5C6C8",
  Amber: "#FFB68E",
  Alert: "#FFB4AB",
};
export type CustomList = {
  id: string;
  name: string;
  type: MediaType;
  createdAt: string;
  description: string;
  accent: ListAccent;
  icon: ListIcon;
};
export type JournalEntry = {
  id: string;
  mediaId: string;
  body: string;
  createdAt: string;
};

export const CREATOR_ROLE: Record<MediaType, string> = {
  Anime: "Studio or creator",
  Manga: "Author",
  Movie: "Director",
  "TV Show": "Creator or writer",
  Book: "Author",
  Game: "Developer",
};

export const TYPE_COLOR: Record<MediaType, string> = {
  Anime: "#A0A3A8",
  Manga: "#A0A3A8",
  Movie: "#A0A3A8",
  "TV Show": "#A0A3A8",
  Book: "#A0A3A8",
  Game: "#A0A3A8",
};

export function emptyDraft(): EntryDraft {
  return {
    type: "Anime",
    title: "",
    alternateTitles: [],
    coverUri: "",
    summary: "",
    creator: "",
    creatorRole: CREATOR_ROLE.Anime,
    releaseYear: null,
    startDate: null,
    endDate: null,
    rating: null,
    duration: null,
    sourceUrl: "",
    status: "Planned",
    note: "",
    listIds: [],
  };
}

export function changeDraftType(
  draft: EntryDraft,
  type: MediaType,
  lists: CustomList[],
): EntryDraft {
  const compatibleIds = new Set(
    lists.filter((list) => list.type === type).map((list) => list.id),
  );
  return {
    ...draft,
    type,
    creatorRole: CREATOR_ROLE[type],
    duration: draft.type === type ? draft.duration : null,
    listIds: draft.listIds.filter((id) => compatibleIds.has(id)),
  };
}
