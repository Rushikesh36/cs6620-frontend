'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { useApi } from './use-api';

export const SCANS_PAGE_SIZE = 20;

/** A project's scan history, newest first. `fetchNextPage` loads the next set ("Load more"). */
export function useProjectScans(
  projectId: string | null | undefined,
  options: { limit?: number; refetchInterval?: number | false } = {},
) {
  const api = useApi();
  const limit = options.limit ?? SCANS_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: queryKeys.projectScansPage(projectId ?? '', limit),
    queryFn: ({ pageParam, signal }) =>
      api.getProjectScans(projectId ?? '', { limit, cursor: pageParam }, signal),
    initialPageParam: null as string | null,
    // A null cursor means this was the last page.
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(projectId),
    staleTime: 10_000,
    refetchInterval: options.refetchInterval ?? false,
  });
}
