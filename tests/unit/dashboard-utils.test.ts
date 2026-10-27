import { describe, expect, it } from 'vitest';
import type { Scan } from '@/lib/api/schemas';
import { computeDashboardStats } from '@/lib/utils/dashboard';
import { scanFixture } from './support/query-wrapper';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();
let n = 0;
const scan = (overrides: Record<string, unknown>) =>
  scanFixture({ jobId: `job-${String(++n).padStart(3, '0')}`, ...overrides }) as Scan;
const summary = (newHigh: number) => ({ new: newHigh, newHigh, stillOpen: 0, fixed: 0 });

describe('computeDashboardStats', () => {
  it('counts scans created in the last 7 days, and not older ones', () => {
    const stats = computeDashboardStats(
      [
        scan({ createdAt: daysAgo(0.1) }),
        scan({ createdAt: daysAgo(6.9) }),
        scan({ createdAt: daysAgo(7.1) }),
        scan({ createdAt: daysAgo(30) }),
      ],
      NOW,
    );
    expect(stats.scansLast7Days).toBe(2);
  });

  it('counts the scans running right now, whatever their age', () => {
    const stats = computeDashboardStats(
      [
        scan({ status: 'RUNNING', createdAt: daysAgo(0) }),
        scan({ status: 'RUNNING', createdAt: daysAgo(20) }),
        scan({ status: 'QUEUED', createdAt: daysAgo(0) }),
        scan({ status: 'COMPLETED', createdAt: daysAgo(0) }),
      ],
      NOW,
    );
    expect(stats.running).toBe(2);
  });

  it('counts failures from the last 7 days, going by when they finished', () => {
    const stats = computeDashboardStats(
      [
        scan({ status: 'FAILED', createdAt: daysAgo(2), finishedAt: daysAgo(2) }),
        scan({ status: 'FAILED', createdAt: daysAgo(9), finishedAt: daysAgo(6) }), // created long ago, failed recently
        scan({ status: 'FAILED', createdAt: daysAgo(9), finishedAt: daysAgo(8) }),
        scan({ status: 'COMPLETED', createdAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(stats.failedLast7Days).toBe(2);
  });

  it('falls back to the creation time for a failure with no finish time', () => {
    const stats = computeDashboardStats(
      [scan({ status: 'FAILED', createdAt: daysAgo(1), finishedAt: null })],
      NOW,
    );
    expect(stats.failedLast7Days).toBe(1);
  });

  it('adds up the new HIGH findings of the 10 most recent finished scans', () => {
    const recent = Array.from({ length: 10 }, (_, i) =>
      scan({ status: 'COMPLETED', createdAt: daysAgo(i * 0.1), summary: summary(1) }),
    );
    const old = scan({ status: 'COMPLETED', createdAt: daysAgo(5), summary: summary(50) });
    expect(computeDashboardStats([...recent, old], NOW).newHighRecent).toBe(10); // the old one is outside the 10
  });

  it('counts nothing for scans that have not finished, or have no summary', () => {
    const stats = computeDashboardStats(
      [
        scan({ status: 'RUNNING', summary: summary(7) }),
        scan({ status: 'FAILED', summary: null }),
        scan({ status: 'COMPLETED', summary: summary(3) }),
      ],
      NOW,
    );
    expect(stats.newHighRecent).toBe(3);
  });

  it('lists the 10 newest scans first, from every project', () => {
    const scans = Array.from({ length: 14 }, (_, i) =>
      scan({ projectId: i % 2 ? 'project-b' : 'project-a', createdAt: daysAgo(i) }),
    );
    const { recentScans } = computeDashboardStats([...scans].reverse(), NOW);
    expect(recentScans).toHaveLength(10);
    expect(recentScans.map((s) => s.jobId)).toEqual(scans.slice(0, 10).map((s) => s.jobId));
    expect(new Set(recentScans.map((s) => s.projectId))).toEqual(
      new Set(['project-a', 'project-b']),
    );
  });

  it('is all zeros and an empty list when there are no scans', () => {
    expect(computeDashboardStats([], NOW)).toEqual({
      scansLast7Days: 0,
      running: 0,
      failedLast7Days: 0,
      newHighRecent: 0,
      recentScans: [],
    });
  });

  it('does not change the list it is given', () => {
    const scans = [scan({ createdAt: daysAgo(3) }), scan({ createdAt: daysAgo(1) })];
    const before = scans.map((s) => s.jobId);
    computeDashboardStats(scans, NOW);
    expect(scans.map((s) => s.jobId)).toEqual(before);
  });
});
