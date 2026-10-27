import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecentScans } from '@/hooks/use-recent-scans';
import { ApiError } from '@/lib/api/client';
import { createWrapper, scanFixture } from './support/query-wrapper';

const { api } = vi.hoisted(() => ({ api: { getProjectScans: vi.fn() } }));
vi.mock('@/hooks/use-api', () => ({ useApi: () => api }));

const page = (projectId: string, ...statuses: string[]) => ({
  items: statuses.map((status, i) =>
    scanFixture({ jobId: `${projectId}-${i}`, projectId, status }),
  ),
  nextCursor: null,
});
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const setup = (projects: string[]) => {
  const { Wrapper } = createWrapper();
  return renderHook(() => useRecentScans(projects), { wrapper: Wrapper });
};

beforeEach(() => {
  vi.useFakeTimers();
  api.getProjectScans.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useRecentScans', () => {
  it('asks for the newest scans of every project, and joins the answers', async () => {
    api.getProjectScans.mockImplementation(async (projectId: string) =>
      projectId === 'a-app' ? page('a-app', 'COMPLETED', 'FAILED') : page('b-app', 'COMPLETED'),
    );
    const { result } = setup(['a-app', 'b-app']);

    await vi.waitFor(() => expect(result.current.isPending).toBe(false));

    expect(api.getProjectScans).toHaveBeenCalledWith('a-app', { limit: 20 }, expect.anything());
    expect(api.getProjectScans).toHaveBeenCalledWith('b-app', { limit: 20 }, expect.anything());
    expect(result.current.scans.map((s) => s.jobId).sort()).toEqual([
      'a-app-0',
      'a-app-1',
      'b-app-0',
    ]);
    expect(result.current).toMatchObject({ failedCount: 0, allFailed: false, projectCount: 2 });
  });

  it('is pending until every project has answered', async () => {
    let finishB: (value: unknown) => void = () => {};
    api.getProjectScans.mockImplementation((projectId: string) =>
      projectId === 'a-app'
        ? Promise.resolve(page('a-app', 'COMPLETED'))
        : new Promise((resolve) => (finishB = resolve)),
    );
    const { result } = setup(['a-app', 'b-app']);

    await advance(10);
    expect(result.current.isPending).toBe(true);

    await act(async () => finishB(page('b-app', 'COMPLETED')));
    await vi.waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('keeps the other projects when one fails, and says how many failed', async () => {
    api.getProjectScans.mockImplementation(async (projectId: string) => {
      if (projectId === 'bad-app') throw new ApiError(404, 'Not found.');
      return page(projectId, 'COMPLETED');
    });
    const { result } = setup(['good-app', 'bad-app']);

    await vi.waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.scans.map((s) => s.jobId)).toEqual(['good-app-0']);
    expect(result.current).toMatchObject({ failedCount: 1, allFailed: false });
  });

  it('reports "all failed" only when nothing at all could be loaded', async () => {
    api.getProjectScans.mockRejectedValue(new ApiError(404, 'Not found.'));
    const { result } = setup(['a-app', 'b-app']);

    await vi.waitFor(() => expect(result.current.allFailed).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.scans).toEqual([]);
  });

  it('can reload everything', async () => {
    api.getProjectScans.mockResolvedValue(page('a-app', 'COMPLETED'));
    const { result } = setup(['a-app', 'b-app']);
    await vi.waitFor(() => expect(result.current.isPending).toBe(false));
    api.getProjectScans.mockClear();

    await act(async () => {
      await result.current.refetchAll();
    });

    expect(api.getProjectScans).toHaveBeenCalledTimes(2);
  });

  it('handles an empty list of projects', () => {
    const { result } = setup([]);
    expect(result.current).toMatchObject({
      scans: [],
      isPending: false,
      projectCount: 0,
      allFailed: false,
    });
    expect(api.getProjectScans).not.toHaveBeenCalled();
  });

  it('keeps refreshing a project every 15 seconds while it has an unfinished scan, then stops', async () => {
    api.getProjectScans
      .mockResolvedValueOnce(page('a-app', 'RUNNING'))
      .mockResolvedValue(page('a-app', 'COMPLETED'));
    const { result } = setup(['a-app']);

    await advance(0);
    expect(api.getProjectScans).toHaveBeenCalledTimes(1);

    await advance(15_000);
    await vi.waitFor(() => expect(result.current.scans[0]?.status).toBe('COMPLETED'));
    expect(api.getProjectScans).toHaveBeenCalledTimes(2);

    await advance(10 * 60_000);
    expect(api.getProjectScans).toHaveBeenCalledTimes(2);
  });

  it('never refreshes by itself when every scan is finished', async () => {
    api.getProjectScans.mockResolvedValue(page('a-app', 'COMPLETED', 'FAILED'));
    setup(['a-app']);

    await advance(10 * 60_000);
    expect(api.getProjectScans).toHaveBeenCalledTimes(1);
  });
});
