export const MEDIA_TYPES = ["Anime", "Manga", "Movie", "Book", "Game"] as const;
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
  rating: number | null;
  duration: number | null;
  status: MediaStatus;
  note: string;
  listIds: string[];
  updatedAt: string;
};

export type EntryDraft = Omit<MediaEntry, "id" | "updatedAt"> & { id?: string };

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
  Anime: "Episodes",
  Game: null,
};
export function formatDuration(
  type: MediaType,
  value: number | null,
): string | null {
  if (!value || type === "Game") return null;
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
  Book: "Author",
  Game: "Developer",
};

export const TYPE_COLOR: Record<MediaType, string> = {
  Anime: "#A0A3A8",
  Manga: "#A0A3A8",
  Movie: "#A0A3A8",
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
    rating: null,
    duration: null,
    status: "Planned",
    note: "",
    listIds: [],
  };
}
