'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isFinalStatus } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/query-keys';
import { shouldRetry } from '@/lib/query/query-client';
import { pollDelay } from '@/lib/utils/polling';
import { useApi } from './use-api';

/**
 * One scan job. Pass null until the ID is known and nothing is fetched.
 *
 * With `poll`, it asks again every 5 seconds until the scan is COMPLETED or FAILED:
 * - it stops for good at that point, because a finished scan never changes;
 * - it pauses while the browser tab is hidden and looks again as soon as the tab is shown;
 * - after failed attempts it waits longer (5s, 10s, 20s ... up to 60s) and keeps showing the
 *   last scan it received.
 */
export function useScan(jobId: string | null | undefined, options: { poll?: boolean } = {}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const poll = options.poll ?? false;
  // Failed attempts in a row. TanStack's own counters reset on every fetch, so we count here.
  const [failedPolls, setFailedPolls] = useState(0);
  const key = queryKeys.scan(jobId ?? '');

  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      try {
        const scan = await api.getScan(jobId ?? '', signal);
        setFailedPolls(0);
        return scan;
      } catch (error) {
        if (!signal.aborted) setFailedPolls((count) => count + 1);
        throw error;
      }
    },
    enabled: Boolean(jobId),
    // COMPLETED and FAILED never change again, so keep them forever and never refetch.
    // Unfinished scans are always treated as out of date.
    staleTime: (query) =>
      query.state.data && isFinalStatus(query.state.data.status) ? Infinity : 0,
    refetchOnWindowFocus: (query) => !(query.state.data && isFinalStatus(query.state.data.status)),
    refetchInterval: poll
      ? (query) =>
          query.state.data && isFinalStatus(query.state.data.status)
            ? false
            : pollDelay(failedPolls)
      : false,
    // While polling, the page already shows the last good answer plus "Reconnecting...", and the
    // next poll is coming anyway, so a failed poll isn't retried on top of that. The first load
    // still is. (Spread, so that without polling the app-wide retry setting is left alone.)
    ...(poll && {
      retry: (failureCount: number, error: Error) =>
        queryClient.getQueryData(key) === undefined && shouldRetry(failureCount, error),
    }),
  });
}
