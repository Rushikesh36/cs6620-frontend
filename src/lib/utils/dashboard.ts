import { isFinalStatus, type Scan } from '@/lib/api/schemas';

export const DASHBOARD_DAYS = 7;
export const RECENT_SCAN_COUNT = 10;
const DAY_MS = 86_400_000;

export type DashboardStats = {
  /** Scans created in the last 7 days. */
  scansLast7Days: number;
  /** Scans a scanner is working on right now. */
  running: number;
  /** Scans that failed in the last 7 days. */
  failedLast7Days: number;
  /** New HIGH findings reported by the most recent scans. */
  newHighRecent: number;
  /** The newest scans first, at most 10. */
  recentScans: Scan[];
};

function newestFirst(a: Scan, b: Scan): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.jobId.localeCompare(a.jobId);
}

export function computeDashboardStats(scans: Scan[], nowMs: number): DashboardStats {
  const since = nowMs - DASHBOARD_DAYS * DAY_MS;
  const sorted = [...scans].sort(newestFirst);
  const recentScans = sorted.slice(0, RECENT_SCAN_COUNT);

  return {
    scansLast7Days: scans.filter((scan) => Date.parse(scan.createdAt) >= since).length,
    running: scans.filter((scan) => scan.status === 'RUNNING').length,
    failedLast7Days: scans.filter(
      (scan) => scan.status === 'FAILED' && Date.parse(scan.finishedAt ?? scan.createdAt) >= since,
    ).length,
    // Only finished scans have a summary. The others count as zero until they do.
    newHighRecent: recentScans.reduce(
      (total, scan) => total + (isFinalStatus(scan.status) ? (scan.summary?.newHigh ?? 0) : 0),
      0,
    ),
    recentScans,
  };
}
