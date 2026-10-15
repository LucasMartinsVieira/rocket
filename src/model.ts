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
  status: MediaStatus;
  note: string;
  listIds: string[];
  updatedAt: string;
};

export type EntryDraft = Omit<MediaEntry, "id" | "updatedAt"> & { id?: string };

export type CustomList = { id: string; name: string; createdAt: string };
export type JournalEntry = { id: string; mediaId: string; body: string; createdAt: string };

export const CREATOR_ROLE: Record<MediaType, string> = {
  Anime: "Studio or creator",
  Manga: "Author",
  Movie: "Director",
  Book: "Author",
  Game: "Developer",
};

export const TYPE_COLOR: Record<MediaType, string> = {
  Anime: "#6251D5",
  Manga: "#B94E83",
  Movie: "#3474A8",
  Book: "#4D8164",
  Game: "#BD7738",
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
    status: "Planned",
    note: "",
    listIds: [],
  };
}
