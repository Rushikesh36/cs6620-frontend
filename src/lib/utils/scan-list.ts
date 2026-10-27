import type { Scan, ScanStatus, ScanType } from '@/lib/api/schemas';

export type ScanSort = 'newest' | 'oldest';
export type ScanFilters = { scanType: ScanType | null; status: ScanStatus | null };

export const AUTO_REFRESH_MS = 15_000;

/** The scans that match the chosen type and status. `null` means "any". */
export function filterScans(scans: Scan[], filters: ScanFilters): Scan[] {
  return scans.filter(
    (scan) =>
      (filters.scanType === null || scan.scanType === filters.scanType) &&
      (filters.status === null || scan.status === filters.status),
  );
}

/** Sorted by when the scan was created. Returns a new list. */
export function sortScans(scans: Scan[], sort: ScanSort): Scan[] {
  const direction = sort === 'newest' ? -1 : 1;
  return [...scans].sort((a, b) => direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
}

/** "3f9a1c0e-7b2d" becomes "3f9a1c0e…". Short IDs are left alone. */
export function shortJobId(jobId: string): string {
  return jobId.length > 12 ? `${jobId.slice(0, 8)}…` : jobId;
}

/** How long the scanner worked, in ms, or null if it never started. Running scans count up to now. */
export function scanDurationMs(
  scan: Pick<Scan, 'status' | 'startedAt' | 'finishedAt'>,
  nowMs: number,
): number | null {
  if (!scan.startedAt) return null;
  const started = Date.parse(scan.startedAt);
  if (scan.finishedAt) return Math.max(0, Date.parse(scan.finishedAt) - started);
  return scan.status === 'RUNNING' ? Math.max(0, nowMs - started) : null;
}

export function scanDetailHref(jobId: string): string {
  return `/scans/detail/?jobId=${encodeURIComponent(jobId)}`;
}
