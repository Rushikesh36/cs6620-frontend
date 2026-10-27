import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { createQueryClient, shouldRetry } from '@/lib/query/query-client';
import { queryKeys } from '@/lib/query/query-keys';

describe('queryKeys', () => {
  it('gives each resource its own key, general to specific', () => {
    expect(queryKeys.targets).toEqual(['targets']);
    expect(queryKeys.scan('j1')).toEqual(['scans', 'j1']);
    expect(queryKeys.projectScans('demo-app')).toEqual(['projects', 'demo-app', 'scans']);
    expect(queryKeys.findings('demo-app', 'SAST')).toEqual([
      'projects',
      'demo-app',
      'findings',
      'SAST',
    ]);
  });

  it('keeps different projects, jobs and scan types apart', () => {
    expect(queryKeys.scan('a')).not.toEqual(queryKeys.scan('b'));
    expect(queryKeys.findings('p', 'SAST')).not.toEqual(queryKeys.findings('p', 'DAST'));
    expect(queryKeys.findings('p1', 'SAST')).not.toEqual(queryKeys.findings('p2', 'SAST'));
  });

  it('starts every page-size key with the project list key, so one invalidation covers them all', () => {
    const prefix = queryKeys.projectScans('demo-app');
    expect(queryKeys.projectScansPage('demo-app', 20).slice(0, prefix.length)).toEqual(prefix);
    expect(queryKeys.projectScansPage('demo-app', 50).slice(0, prefix.length)).toEqual(prefix);
  });
});

describe('shouldRetry', () => {
  it('retries problems that can go away: no answer, timeout, 5xx, 408 and 429', () => {
    expect(shouldRetry(0, new ApiError(0, 'x', 'network'))).toBe(true);
    expect(shouldRetry(0, new ApiError(0, 'x', 'timeout'))).toBe(true);
    expect(shouldRetry(0, new ApiError(500, 'x'))).toBe(true);
    expect(shouldRetry(0, new ApiError(503, 'x'))).toBe(true);
    expect(shouldRetry(0, new ApiError(408, 'x'))).toBe(true);
    expect(shouldRetry(0, new ApiError(429, 'x'))).toBe(true);
  });

  it('does not retry things that fail the same way every time', () => {
    expect(shouldRetry(0, new ApiError(400, 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(403, 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(200, 'x', 'invalid_response'))).toBe(false);
  });

  it('gives up after two retries', () => {
    const error = new ApiError(500, 'x');
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(false);
  });

  it('retries unknown errors a couple of times too', () => {
    expect(shouldRetry(0, new Error('boom'))).toBe(true);
    expect(shouldRetry(2, new Error('boom'))).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('never retries mutations, so a failed "create scan" cannot make two jobs', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.queries?.retry).toBe(shouldRetry);
    expect(defaults.queries?.staleTime).toBe(30_000);
  });
});
