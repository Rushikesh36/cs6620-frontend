import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateScan } from '@/hooks/use-create-scan';
import { useFindings } from '@/hooks/use-findings';
import { useProjectScans } from '@/hooks/use-project-scans';
import { useScan } from '@/hooks/use-scan';
import { useStartScan } from '@/hooks/use-start-scan';
import { useTargets } from '@/hooks/use-targets';
import { queryKeys } from '@/lib/query/query-keys';
import { createWrapper, scanFixture } from './support/query-wrapper';

const { api } = vi.hoisted(() => ({
  api: {
    getScan: vi.fn(),
    getProjectScans: vi.fn(),
    getFindings: vi.fn(),
    getTargets: vi.fn(),
    createScan: vi.fn(),
    startScan: vi.fn(),
  },
}));
vi.mock('@/hooks/use-api', () => ({ useApi: () => api }));

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe('useScan', () => {
  it('loads a scan by ID', async () => {
    api.getScan.mockResolvedValue(scanFixture());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useScan('job-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.jobId).toBe('job-1'));
    expect(api.getScan).toHaveBeenCalledWith('job-1', expect.anything());
  });

  it('does nothing until it has an ID', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useScan(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.getScan).not.toHaveBeenCalled();
  });

  it('looks again at a scan that is still running when the page is shown again', async () => {
    api.getScan.mockResolvedValue(scanFixture({ status: 'RUNNING' }));
    const { Wrapper } = createWrapper();

    const first = renderHook(() => useScan('job-1'), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();
    renderHook(() => useScan('job-1'), { wrapper: Wrapper });

    await waitFor(() => expect(api.getScan).toHaveBeenCalledTimes(2));
  });

  it.each(['COMPLETED', 'FAILED'] as const)(
    'never asks again about a %s scan: it cannot change',
    async (status) => {
      api.getScan.mockResolvedValue(scanFixture({ status }));
      const { Wrapper } = createWrapper();

      const first = renderHook(() => useScan('job-1'), { wrapper: Wrapper });
      await waitFor(() => expect(first.result.current.data?.status).toBe(status));
      first.unmount();
      const second = renderHook(() => useScan('job-1'), { wrapper: Wrapper });

      expect(second.result.current.data?.status).toBe(status);
      expect(second.result.current.isStale).toBe(false);
      expect(api.getScan).toHaveBeenCalledTimes(1);
    },
  );

  it('reports an error instead of throwing', async () => {
    api.getScan.mockRejectedValue(new Error('nope'));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useScan('job-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useProjectScans', () => {
  const page = (ids: string[], nextCursor: string | null) => ({
    items: ids.map((jobId) => scanFixture({ jobId })),
    nextCursor,
  });

  it('loads the first page, then the next one using the cursor', async () => {
    api.getProjectScans
      .mockResolvedValueOnce(page(['a', 'b'], 'cursor-2'))
      .mockResolvedValueOnce(page(['c'], null));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useProjectScans('demo-app', { limit: 2 }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(api.getProjectScans).toHaveBeenNthCalledWith(
      1,
      'demo-app',
      { limit: 2, cursor: null },
      expect.anything(),
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(api.getProjectScans).toHaveBeenNthCalledWith(
      2,
      'demo-app',
      { limit: 2, cursor: 'cursor-2' },
      expect.anything(),
    );
    await waitFor(() =>
      expect(result.current.data?.pages.flatMap((p) => p.items.map((s) => s.jobId))).toEqual([
        'a',
        'b',
        'c',
      ]),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('does nothing without a project', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectScans(''), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.getProjectScans).not.toHaveBeenCalled();
  });
});

describe('useFindings', () => {
  it('loads findings for a project and scan type, and returns just the list', async () => {
    const finding = {
      fingerprint: 'f'.repeat(64),
      ruleId: 'r',
      severity: 'HIGH',
      location: 'a.py:1',
      message: 'm',
      state: 'OPEN',
      firstSeenJobId: 'j',
      lastSeenJobId: 'j',
    };
    api.getFindings.mockResolvedValue({ items: [finding] });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useFindings('demo-app', 'DAST'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual([finding]));
    expect(api.getFindings).toHaveBeenCalledWith('demo-app', 'DAST', expect.anything());
  });

  it('keeps SAST and DAST results in separate caches', async () => {
    api.getFindings.mockResolvedValue({ items: [] });
    const { Wrapper, queryClient } = createWrapper();

    renderHook(() => useFindings('demo-app', 'SAST'), { wrapper: Wrapper });
    renderHook(() => useFindings('demo-app', 'DAST'), { wrapper: Wrapper });

    await waitFor(() => expect(api.getFindings).toHaveBeenCalledTimes(2));
    expect(queryClient.getQueryData(queryKeys.findings('demo-app', 'SAST'))).toBeDefined();
    expect(queryClient.getQueryData(queryKeys.findings('demo-app', 'DAST'))).toBeDefined();
  });
});

describe('useTargets', () => {
  it('returns the allow-list and is not refetched when the window is focused again', async () => {
    api.getTargets.mockResolvedValue({
      targets: [{ targetId: 'juice-shop', name: 'Juice Shop', description: 'd' }],
    });
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useTargets(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.targetId).toBe('juice-shop'));
    const observerOptions = queryClient.getQueryCache().find({ queryKey: queryKeys.targets })
      ?.observers[0]?.options;
    expect(observerOptions?.refetchOnWindowFocus).toBe(false);
    expect(observerOptions?.staleTime).toBe(5 * 60_000);
  });
});

describe('mutations', () => {
  it("useCreateScan sends the request and refreshes that project's scan list", async () => {
    api.createScan.mockResolvedValue({ jobId: 'j1', status: 'CREATED' });
    const { Wrapper, queryClient } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateScan(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        projectId: 'demo-app',
        scanType: 'DAST',
        targetId: 'juice-shop',
      });
    });

    expect(api.createScan).toHaveBeenCalledWith({
      projectId: 'demo-app',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.projectScans('demo-app') });
  });

  it('useCreateScan does not retry a failure by itself', async () => {
    api.createScan.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateScan(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ projectId: 'demo-app', scanType: 'SAST' }).catch(() => {});
    });

    expect(api.createScan).toHaveBeenCalledTimes(1);
  });

  it('useStartScan starts the job and refreshes the scan and the project list', async () => {
    api.startScan.mockResolvedValue({ jobId: 'j1', status: 'QUEUED' });
    const { Wrapper, queryClient } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartScan(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ jobId: 'j1', projectId: 'demo-app' });
    });

    expect(api.startScan).toHaveBeenCalledWith('j1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.scan('j1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.projectScans('demo-app') });
  });
});
