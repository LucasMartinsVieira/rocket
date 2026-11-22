import type { MediaType } from "./model";

// Catalog data stays separate from user-owned status, notes, and memberships.
export type CatalogResult = {
  id: string;
  // Required for migrated adapters; legacy results still route by media type.
  adapterId?: string;
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

export type CatalogPage = { results: CatalogResult[]; total: number };

export type AdapterCatalogResult = CatalogResult & { adapterId: string };

export type CatalogSearch = {
  query: string;
  cursor?: string;
  signal?: AbortSignal;
};

export type CatalogSearchPage = {
  results: AdapterCatalogResult[];
  total?: number;
  nextCursor?: string;
};

export interface CatalogAdapter {
  readonly id: string;
  search(input: CatalogSearch): Promise<CatalogSearchPage>;
  details(
    result: CatalogResult,
    signal?: AbortSignal,
  ): Promise<AdapterCatalogResult>;
}

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
