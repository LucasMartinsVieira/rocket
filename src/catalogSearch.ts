import type { CatalogResult } from "./catalog";
import { catalogAdapters } from "./providers/registry";

type AdapterId = keyof typeof catalogAdapters;
export type CatalogFilter = AdapterId | "all";

type PageRequest = { adapterId: AdapterId; cursor?: string };
type Continuation = { query: string; page: number; requests: PageRequest[] };

export type CatalogSearchSession = {
  results: CatalogResult[];
  errors: string[];
  continuation?: Continuation;
};

const adapterIds = Object.keys(catalogAdapters) as AdapterId[];
const pageLimit = 100;

function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Lookup cancelled.");
}

async function searchPage(
  { query, page, requests }: Continuation,
  previous: CatalogResult[],
  signal?: AbortSignal,
): Promise<CatalogSearchSession> {
  checkCancellation(signal);
  const responses = await Promise.allSettled(
    requests.map(async ({ adapterId, cursor }) =>
      catalogAdapters[adapterId].search({ query, cursor, signal }),
    ),
  );
  checkCancellation(signal);

  const results = new Map(previous.map((result) => [result.id, result]));
  const errors = new Set<string>();
  const nextRequests: PageRequest[] = [];
  for (const [index, response] of responses.entries()) {
    if (response.status === "rejected") {
      errors.add(
        response.reason instanceof Error
          ? response.reason.message
          : "Provider lookup failed.",
      );
      continue;
    }
    for (const result of response.value.results) results.set(result.id, result);
    const cursor = response.value.nextCursor;
    if (cursor !== undefined)
      nextRequests.push({ adapterId: requests[index].adapterId, cursor });
  }
  return {
    results: [...results.values()],
    errors: [...errors],
    continuation:
      page < pageLimit && nextRequests.length
        ? { query, page: page + 1, requests: nextRequests }
        : undefined,
  };
}

export function searchCatalog(
  query: string,
  filter: CatalogFilter,
  signal?: AbortSignal,
) {
  const ids = filter === "all" ? adapterIds : [filter];
  return searchPage(
    {
      query: query.trim(),
      page: 1,
      requests: ids.map((adapterId) => ({ adapterId })),
    },
    [],
    signal,
  );
}

export async function loadMoreCatalogResults(
  session: CatalogSearchSession,
  signal?: AbortSignal,
): Promise<CatalogSearchSession> {
  return session.continuation
    ? searchPage(session.continuation, session.results, signal)
    : session;
}

export async function getCatalogDetails(
  result: CatalogResult,
  signal?: AbortSignal,
) {
  checkCancellation(signal);
  const adapter = Object.values(catalogAdapters).find(
    (candidate) => candidate.id === result.adapterId,
  );
  if (!adapter)
    throw new Error("Could not find a catalog provider for this title.");
  const details = await adapter.details(result, signal);
  checkCancellation(signal);
  return details;
}
