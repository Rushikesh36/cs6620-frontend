'use client';

import { useQueries } from '@tanstack/react-query';
import { isFinalStatus, type Scan } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/query-keys';
import { AUTO_REFRESH_MS } from '@/lib/utils/scan-list';
import { SCANS_PAGE_SIZE } from './use-project-scans';
import { useApi } from './use-api';

/**
 * The newest scans of several projects, as one list. The API has no "all scans" call, so this
 * asks for each project separately and combines the answers. One project failing does not hide
 * the others.
 */
export function useRecentScans(projectIds: string[]) {
  const api = useApi();
  return useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: queryKeys.projectScansLatest(projectId, SCANS_PAGE_SIZE),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.getProjectScans(projectId, { limit: SCANS_PAGE_SIZE }, signal),
      staleTime: 10_000,
      // Keep looking while a scan is still going, so "Running now" stays true.
      refetchInterval: (query: { state: { data?: { items: Scan[] } } }) =>
        query.state.data?.items.some((scan) => !isFinalStatus(scan.status))
          ? AUTO_REFRESH_MS
          : false,
    })),
    combine: (results) => {
      const failed = results.filter((result) => result.isError);
      return {
        scans: results.flatMap((result) => result.data?.items ?? []),
        isPending: results.some((result) => result.isPending),
        projectCount: results.length,
        failedCount: failed.length,
        // Nothing at all could be loaded.
        allFailed:
          results.length > 0 && failed.length === results.length && results.every((r) => !r.data),
        error: failed[0]?.error ?? null,
        refetchAll: () => Promise.all(results.map((result) => result.refetch())),
      };
    },
  });
}
