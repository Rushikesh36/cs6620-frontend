import { describe, expect, it } from 'vitest';
import type { Scan } from '@/lib/api/schemas';
import {
  filterScans,
  scanDetailHref,
  scanDurationMs,
  shortJobId,
  sortScans,
} from '@/lib/utils/scan-list';
import { scanFixture } from './support/query-wrapper';

const scan = (overrides: Record<string, unknown>) => scanFixture(overrides) as Scan;

const scans = [
  scan({ jobId: 'a', scanType: 'SAST', status: 'COMPLETED', createdAt: '2026-03-01T10:00:00Z' }),
  scan({ jobId: 'b', scanType: 'DAST', status: 'FAILED', createdAt: '2026-03-01T12:00:00Z' }),
  scan({ jobId: 'c', scanType: 'SAST', status: 'RUNNING', createdAt: '2026-03-01T11:00:00Z' }),
  scan({ jobId: 'd', scanType: 'DAST', status: 'COMPLETED', createdAt: '2026-03-01T09:00:00Z' }),
];
const ids = (list: Scan[]) => list.map((s) => s.jobId);

describe('filterScans', () => {
  it('keeps everything when no filter is set', () => {
    expect(ids(filterScans(scans, { scanType: null, status: null }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters by scan type, by status, and by both together', () => {
    expect(ids(filterScans(scans, { scanType: 'SAST', status: null }))).toEqual(['a', 'c']);
    expect(ids(filterScans(scans, { scanType: null, status: 'COMPLETED' }))).toEqual(['a', 'd']);
    expect(ids(filterScans(scans, { scanType: 'DAST', status: 'COMPLETED' }))).toEqual(['d']);
    expect(filterScans(scans, { scanType: 'SAST', status: 'FAILED' })).toEqual([]);
  });
});

describe('sortScans', () => {
  it('sorts newest or oldest first by creation time, without changing the original list', () => {
    expect(ids(sortScans(scans, 'newest'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(sortScans(scans, 'oldest'))).toEqual(['d', 'a', 'c', 'b']);
    expect(ids(scans)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('shortJobId', () => {
  it('cuts long IDs to 8 characters and an ellipsis, and leaves short ones alone', () => {
    expect(shortJobId('3f9a1c0e-7b2d4a51')).toBe('3f9a1c0e…');
    expect(shortJobId('3f9a1c0e-7b2d')).toBe('3f9a1c0e…');
    expect(shortJobId('job-123')).toBe('job-123');
    expect(shortJobId('exactly12chr')).toBe('exactly12chr');
  });
});

describe('scanDurationMs', () => {
  const now = Date.parse('2026-03-01T12:10:00Z');

  it('is the time between start and finish for a finished scan', () => {
    expect(
      scanDurationMs(
        {
          status: 'COMPLETED',
          startedAt: '2026-03-01T12:00:00Z',
          finishedAt: '2026-03-01T12:00:20Z',
        },
        now,
      ),
    ).toBe(20_000);
  });

  it('counts up to now for a running scan', () => {
    expect(
      scanDurationMs(
        { status: 'RUNNING', startedAt: '2026-03-01T12:07:00Z', finishedAt: null },
        now,
      ),
    ).toBe(180_000);
  });

  it('is null when the scanner never started, or has not started yet', () => {
    expect(
      scanDurationMs(
        { status: 'FAILED', startedAt: null, finishedAt: '2026-03-01T12:00:05Z' },
        now,
      ),
    ).toBeNull();
    expect(scanDurationMs({ status: 'QUEUED', startedAt: null, finishedAt: null }, now)).toBeNull();
  });

  it('never goes negative', () => {
    expect(
      scanDurationMs(
        { status: 'RUNNING', startedAt: '2026-03-01T12:30:00Z', finishedAt: null },
        now,
      ),
    ).toBe(0);
  });
});

describe('scanDetailHref', () => {
  it('links to the detail page and encodes the ID', () => {
    expect(scanDetailHref('abc-123')).toBe('/scans/detail/?jobId=abc-123');
    expect(scanDetailHref('a&b')).toBe('/scans/detail/?jobId=a%26b');
  });
});
