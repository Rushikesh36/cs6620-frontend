import type { Scan } from '@/lib/api/schemas';

export const QUEUED_WARNING_MS = 10 * 60_000;
export const RUNNING_WARNING_MS = 25 * 60_000;

/**
 * True when a scan has waited or run longer than usual. Only a warning: the backend marks a
 * stuck scan FAILED on its own, so the page never gives up on it.
 */
export function isTakingLongerThanUsual(
  scan: Pick<Scan, 'status' | 'createdAt' | 'queuedAt' | 'startedAt'>,
  nowMs: number,
): boolean {
  if (scan.status === 'QUEUED') {
    return nowMs - Date.parse(scan.queuedAt ?? scan.createdAt) > QUEUED_WARNING_MS;
  }
  if (scan.status === 'RUNNING') {
    return (
      nowMs - Date.parse(scan.startedAt ?? scan.queuedAt ?? scan.createdAt) > RUNNING_WARNING_MS
    );
  }
  return false;
}
