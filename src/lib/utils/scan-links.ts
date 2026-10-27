import type { Scan } from '@/lib/api/schemas';

/** The project's findings for this scan's type. The project page reads `scanType` from the link. */
export function findingsHref(scan: Pick<Scan, 'projectId' | 'scanType'>): string {
  const params = new URLSearchParams({ projectId: scan.projectId, scanType: scan.scanType });
  return `/projects/detail/?${params.toString()}`;
}

/** The new-scan form, pre-filled with this scan's type, project and (for app scans) test app. */
export function rerunHref(scan: Pick<Scan, 'projectId' | 'scanType' | 'targetId'>): string {
  const params = new URLSearchParams({ type: scan.scanType, project: scan.projectId });
  if (scan.scanType === 'DAST' && scan.targetId) params.set('target', scan.targetId);
  return `/scans/new/?${params.toString()}`;
}
