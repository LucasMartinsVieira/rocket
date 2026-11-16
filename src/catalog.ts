import type { MediaType } from "./model";

// Catalog data stays separate from user-owned status, notes, and memberships.
export type CatalogResult = {
  id: string;
  provider: string;
  sourceUrl: string;
  type: MediaType;
  title: string;
  coverUri: string;
  releaseYear: number | null;
  creator: string;
  summary: string;
};

export type CatalogPage = { results: CatalogResult[]; total: number };

export interface CatalogProvider {
  search(
    query: string,
    key: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<CatalogPage>;
  details(
    id: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<CatalogResult>;
}
