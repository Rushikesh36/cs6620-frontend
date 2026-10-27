'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Scan } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/query-keys';
import { AUTO_REFRESH_MS } from '@/lib/utils/scan-list';
import { useApi } from './use-api';

export const SCANS_PAGE_SIZE = 20;

/**
 * A project's scan history, newest first. `fetchNextPage` loads the next set ("Load more").
 *
 * `autoRefreshWhile` is asked about the scans loaded so far. While it says yes, the list is
 * refreshed every 15 seconds (and not while the browser tab is hidden).
 */
export function useProjectScans(
  projectId: string | null | undefined,
  options: { limit?: number; autoRefreshWhile?: (scans: Scan[]) => boolean } = {},
) {
  const api = useApi();
  const limit = options.limit ?? SCANS_PAGE_SIZE;
  const { autoRefreshWhile } = options;
  return useInfiniteQuery({
    queryKey: queryKeys.projectScansPage(projectId ?? '', limit),
    queryFn: ({ pageParam, signal }) =>
      api.getProjectScans(projectId ?? '', { limit, cursor: pageParam }, signal),
    initialPageParam: null as string | null,
    // A null cursor means this was the last page.
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(projectId),
    staleTime: 10_000,
    refetchInterval: autoRefreshWhile
      ? (query) => {
          const pages = query.state.data?.pages;
          return pages && autoRefreshWhile(pages.flatMap((page) => page.items))
            ? AUTO_REFRESH_MS
            : false;
        }
      : false,
  });
}
