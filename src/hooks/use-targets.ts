'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { useApi } from './use-api';

const FIVE_MINUTES = 5 * 60_000;

/** The DAST allow-list. It almost never changes, so it is cached for a while. */
export function useTargets() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.targets,
    queryFn: ({ signal }) => api.getTargets(signal),
    select: (data) => data.targets,
    staleTime: FIVE_MINUTES,
    refetchOnWindowFocus: false,
  });
}
