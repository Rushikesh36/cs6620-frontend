import { describe, expect, it } from 'vitest';
import { explainScanError } from '@/lib/utils/scan-errors';
import { findingsHref, rerunHref } from '@/lib/utils/scan-links';
import {
  isTakingLongerThanUsual,
  QUEUED_WARNING_MS,
  RUNNING_WARNING_MS,
} from '@/lib/utils/slow-scan';

describe('explainScanError', () => {
  it.each([
    ['Scanner exited with code 1', 'The scanner stopped with an error before it could finish.'],
    ['Scanner exited with code 137', 'The scanner stopped with an error before it could finish.'],
    [
      'No report produced',
      "The scanner finished but didn't produce a report, so there are no results.",
    ],
    ['Timed out after 25 minutes', 'The scan ran for too long, so it was stopped.'],
    [
      'Could not start scanner task',
      "We couldn't start a scanner for this scan. This is usually temporary.",
    ],
  ])('explains "%s" in plain words and keeps the original', (error, summary) => {
    expect(explainScanError(error)).toEqual({ summary, detail: error });
  });

  it('gives a general sentence for a message it does not know, and still shows it', () => {
    expect(explainScanError('Disk quota exceeded')).toEqual({
      summary: 'The scan failed.',
      detail: 'Disk quota exceeded',
    });
  });

  it('copes with a missing or blank message', () => {
    for (const empty of [null, '', '   ']) {
      expect(explainScanError(empty)).toEqual({
        summary: "The scan failed, but the scanner didn't say why.",
        detail: null,
      });
    }
  });
});

describe('scan links', () => {
  it('links to the findings of the same project and scan type', () => {
    expect(findingsHref({ projectId: 'demo-app', scanType: 'SAST' })).toBe(
      '/projects/detail/?projectId=demo-app&scanType=SAST',
    );
    expect(findingsHref({ projectId: 'web-shop', scanType: 'DAST' })).toBe(
      '/projects/detail/?projectId=web-shop&scanType=DAST',
    );
  });

  it('re-runs a code scan with the same type and project, and no test app', () => {
    expect(rerunHref({ projectId: 'demo-app', scanType: 'SAST', targetId: null })).toBe(
      '/scans/new/?type=SAST&project=demo-app',
    );
  });

  it('re-runs an app scan with the same test app', () => {
    expect(rerunHref({ projectId: 'web-shop', scanType: 'DAST', targetId: 'juice-shop' })).toBe(
      '/scans/new/?type=DAST&project=web-shop&target=juice-shop',
    );
  });

  it('encodes anything unusual instead of letting it break the link', () => {
    const href = rerunHref({ projectId: 'a&b=c', scanType: 'DAST', targetId: 'x y' });
    expect(href).toBe('/scans/new/?type=DAST&project=a%26b%3Dc&target=x+y');
    expect(new URL(href, 'http://x').searchParams.get('project')).toBe('a&b=c');
  });
});

describe('isTakingLongerThanUsual', () => {
  const T = Date.parse('2026-03-01T12:00:00Z');
  const at = (msAgo: number) => new Date(T - msAgo).toISOString();
  const queued = (msAgo: number) => ({
    status: 'QUEUED' as const,
    createdAt: at(msAgo + 1000),
    queuedAt: at(msAgo),
    startedAt: null,
  });
  const running = (msAgo: number) => ({
    status: 'RUNNING' as const,
    createdAt: at(msAgo + 9000),
    queuedAt: at(msAgo + 5000),
    startedAt: at(msAgo),
  });

  it('warns about a scan that has waited in the queue for more than 10 minutes', () => {
    expect(isTakingLongerThanUsual(queued(QUEUED_WARNING_MS - 1000), T)).toBe(false);
    expect(isTakingLongerThanUsual(queued(QUEUED_WARNING_MS), T)).toBe(false);
    expect(isTakingLongerThanUsual(queued(QUEUED_WARNING_MS + 1000), T)).toBe(true);
  });

  it('warns about a scan that has been running for more than 25 minutes', () => {
    expect(isTakingLongerThanUsual(running(RUNNING_WARNING_MS - 1000), T)).toBe(false);
    expect(isTakingLongerThanUsual(running(RUNNING_WARNING_MS), T)).toBe(false);
    expect(isTakingLongerThanUsual(running(RUNNING_WARNING_MS + 1000), T)).toBe(true);
  });

  it('counts running time from when it started, not from when it was queued', () => {
    // Queued 30 minutes ago but only started 1 minute ago: not slow.
    const scan = {
      status: 'RUNNING' as const,
      createdAt: at(31 * 60_000),
      queuedAt: at(30 * 60_000),
      startedAt: at(60_000),
    };
    expect(isTakingLongerThanUsual(scan, T)).toBe(false);
  });

  it('never warns for scans that are not waiting or running', () => {
    for (const status of ['CREATED', 'COMPLETED', 'FAILED'] as const) {
      expect(
        isTakingLongerThanUsual(
          {
            status,
            createdAt: at(10 * 3_600_000),
            queuedAt: at(9 * 3_600_000),
            startedAt: at(8 * 3_600_000),
          },
          T,
        ),
      ).toBe(false);
    }
  });
});
