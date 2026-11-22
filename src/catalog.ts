import type { MediaType } from "./model";

// Catalog data stays separate from user-owned status, notes, and memberships.
export type CatalogResult = {
  id: string;
  adapterId: string;
  provider: string;
  sourceUrl: string;
  type: MediaType;
  title: string;
  coverUri: string;
  releaseYear: number | null;
  creator: string;
  summary: string;
  duration?: number | null;
};

export type CatalogSearch = {
  query: string;
  cursor?: string;
  signal?: AbortSignal;
};

export type CatalogSearchPage = {
  results: CatalogResult[];
  total?: number;
  nextCursor?: string;
};

export interface CatalogAdapter {
  readonly id: string;
  search(input: CatalogSearch): Promise<CatalogSearchPage>;
  details(result: CatalogResult, signal?: AbortSignal): Promise<CatalogResult>;
}
