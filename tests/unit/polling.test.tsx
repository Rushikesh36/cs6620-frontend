import { focusManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScan } from '@/hooks/use-scan';
import { ApiError } from '@/lib/api/client';
import { MAX_POLL_DELAY_MS, POLL_INTERVAL_MS, pollDelay } from '@/lib/utils/polling';
import { createWrapper, scanFixture } from './support/query-wrapper';

const { api } = vi.hoisted(() => ({ api: { getScan: vi.fn() } }));
vi.mock('@/hooks/use-api', () => ({ useApi: () => api }));

const running = scanFixture({ status: 'RUNNING' });
const down = new ApiError(0, 'Could not reach the server.', 'network');

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function setup(options: { poll?: boolean } = { poll: true }) {
  const { Wrapper } = createWrapper();
  return renderHook(() => useScan('job-1', options), { wrapper: Wrapper });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2026-03-01T12:00:00Z'));
  api.getScan.mockReset();
});
afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe('pollDelay', () => {
  it.each([
    [0, 5000],
    [1, 5000],
    [2, 10_000],
    [3, 20_000],
    [4, 40_000],
    [5, 60_000],
    [12, 60_000],
  ])('after %i failures in a row it waits %i ms', (failures, expected) => {
    expect(pollDelay(failures)).toBe(expected);
  });

  it('never goes below 5 seconds or above 60 seconds', () => {
    expect(pollDelay(-3)).toBe(POLL_INTERVAL_MS);
    expect(pollDelay(100)).toBe(MAX_POLL_DELAY_MS);
  });
});

describe('scan polling', () => {
  it('asks again every 5 seconds while the scan is not finished', async () => {
    api.getScan.mockResolvedValue(running);
    setup();

    await advance(0);
    expect(api.getScan).toHaveBeenCalledTimes(1);
    await advance(4999);
    expect(api.getScan).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(api.getScan).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(api.getScan).toHaveBeenCalledTimes(3);
  });

  it.each(['COMPLETED', 'FAILED'] as const)(
    'stops for good once the scan is %s',
    async (status) => {
      api.getScan
        .mockResolvedValueOnce(running)
        .mockResolvedValue(scanFixture({ status, finishedAt: '2026-03-01T12:00:20Z' }));
      const { result } = setup();

      await advance(0);
      await advance(5000);
      // The query client passes new answers to React on its own timer, so wait for it.
      await vi.waitFor(() => expect(result.current.data?.status).toBe(status));
      expect(api.getScan).toHaveBeenCalledTimes(2);

      await advance(10 * 60_000);
      expect(api.getScan).toHaveBeenCalledTimes(2);
    },
  );

  it('does not poll at all unless asked to', async () => {
    api.getScan.mockResolvedValue(running);
    setup({ poll: false });

    await advance(60_000);
    expect(api.getScan).toHaveBeenCalledTimes(1);
  });

  it('pauses while the tab is hidden, and looks again as soon as it is shown', async () => {
    api.getScan.mockResolvedValue(running);
    setup();
    await advance(0);
    expect(api.getScan).toHaveBeenCalledTimes(1);

    act(() => focusManager.setFocused(false));
    await advance(30_000);
    expect(api.getScan).toHaveBeenCalledTimes(1);

    act(() => focusManager.setFocused(true));
    await advance(0);
    expect(api.getScan).toHaveBeenCalledTimes(2);

    await advance(5000);
    expect(api.getScan).toHaveBeenCalledTimes(3);
  });
});

describe('scan polling when the network fails', () => {
  it('waits 5s, 10s, 20s, 40s and then 60s between attempts, and keeps the last scan', async () => {
    api.getScan.mockResolvedValueOnce(running).mockRejectedValue(down);
    const { result } = setup();
    await advance(0);
    expect(result.current.isRefetchError).toBe(false);

    await advance(5000); // attempt 2 fails: the next wait is still 5s
    expect(api.getScan).toHaveBeenCalledTimes(2);
    await advance(5000); // attempt 3 fails: now 10s
    expect(api.getScan).toHaveBeenCalledTimes(3);

    await advance(9999);
    expect(api.getScan).toHaveBeenCalledTimes(3);
    await advance(1); // attempt 4 fails: now 20s
    expect(api.getScan).toHaveBeenCalledTimes(4);

    await advance(19_999);
    expect(api.getScan).toHaveBeenCalledTimes(4);
    await advance(1); // attempt 5 fails: now 40s
    expect(api.getScan).toHaveBeenCalledTimes(5);

    await advance(39_999);
    expect(api.getScan).toHaveBeenCalledTimes(5);
    await advance(1); // attempt 6 fails: now 60s, the most it ever waits
    expect(api.getScan).toHaveBeenCalledTimes(6);

    await advance(59_999);
    expect(api.getScan).toHaveBeenCalledTimes(6);
    await advance(1);
    expect(api.getScan).toHaveBeenCalledTimes(7);

    // The page still has the last good answer, and knows the last attempts failed.
    expect(result.current.data?.status).toBe('RUNNING');
    expect(result.current.isRefetchError).toBe(true);
  });

  it('goes back to every 5 seconds after one good answer', async () => {
    api.getScan
      .mockResolvedValueOnce(running)
      .mockRejectedValueOnce(down)
      .mockRejectedValueOnce(down)
      .mockResolvedValue(running);
    const { result } = setup();

    await advance(0); // 1: ok
    await advance(5000); // 2: fails, wait stays 5s
    await advance(5000); // 3: fails, wait becomes 10s
    await advance(10_000); // 4: ok, wait resets
    expect(api.getScan).toHaveBeenCalledTimes(4);
    expect(result.current.isRefetchError).toBe(false);

    await advance(5000);
    expect(api.getScan).toHaveBeenCalledTimes(5);
  });

  it('retries the very first load a couple of times before giving up', async () => {
    api.getScan.mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(running);
    const { result } = setup();

    await advance(0);
    expect(result.current.data).toBeUndefined();
    await advance(3000); // retry after 1s, then 2s
    expect(result.current.data?.jobId).toBe('job-1');
    expect(api.getScan).toHaveBeenCalledTimes(3);
  });
});
