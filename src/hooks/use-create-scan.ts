'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateScanRequest } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/query-keys';
import { useApi } from './use-api';

/** Step 1 of starting a scan: creates the job. SAST then uploads the zip, DAST goes straight on. */
export function useCreateScan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateScanRequest) => api.createScan(request),
    onSuccess: (_response, request) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projectScans(request.projectId) }),
  });
}
