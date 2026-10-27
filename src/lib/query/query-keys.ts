import type { ScanType } from '@/lib/api/schemas';

// Every cache key in the app, in one place. Keys are arrays that go from general to specific,
// so invalidating ['projects', id, 'scans'] also covers every page size of that list.
export const queryKeys = {
  targets: ['targets'] as const,
  scan: (jobId: string) => ['scans', jobId] as const,
  projectScans: (projectId: string) => ['projects', projectId, 'scans'] as const,
  projectScansPage: (projectId: string, limit: number) =>
    ['projects', projectId, 'scans', { limit }] as const,
  // The newest scans of a project as a plain list (the dashboard), not the paged "Load more" list.
  projectScansLatest: (projectId: string, limit: number) =>
    ['projects', projectId, 'scans', { latest: limit }] as const,
  findings: (projectId: string, scanType: ScanType) =>
    ['projects', projectId, 'findings', scanType] as const,
};
