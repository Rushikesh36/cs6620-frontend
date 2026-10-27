'use client';

import { useQuery } from '@tanstack/react-query';
import type { ScanType } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/query-keys';
import { useApi } from './use-api';

/** Current findings for one project and scan type. */
export function useFindings(projectId: string | null | undefined, scanType: ScanType) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.findings(projectId ?? '', scanType),
    queryFn: ({ signal }) => api.getFindings(projectId ?? '', scanType, signal),
    enabled: Boolean(projectId),
    select: (data) => data.items,
    // New scans change findings, so look again when the user comes back to the tab.
    refetchOnWindowFocus: true,
  });
}
