import type { MediaEntry, MediaStatus, MediaType } from "../model";

export type EntryRow = {
  id: string;
  type: MediaType;
  title: string;
  alternate_titles: string;
  cover_uri: string;
  summary: string;
  creator: string;
  creator_role: string;
  release_year: number | null;
  start_date: string | null;
  end_date: string | null;
  rating: number | null;
  duration: number | null;
  source_url: string;
  status: MediaStatus;
  note: string;
  updated_at: string;
};

export function toEntry(row: EntryRow, listIds: string[]): MediaEntry {
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
    startDate: row.start_date,
    endDate: row.end_date,
    rating: row.rating,
    duration: row.duration,
    sourceUrl: row.source_url,
    status: row.status,
    note: row.note,
    listIds,
    updatedAt: row.updated_at,
  };
}
