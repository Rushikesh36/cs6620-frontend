'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { useApi } from './use-api';

/** Moves a job from CREATED to QUEUED. For SAST, call it only after the upload succeeded. */
export function useStartScan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    // projectId is only used to refresh the right history list afterwards.
    mutationFn: ({ jobId }: { jobId: string; projectId: string }) => api.startScan(jobId),
    onSuccess: (_response, { jobId, projectId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scan(jobId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projectScans(projectId) }),
      ]),
  });
}
