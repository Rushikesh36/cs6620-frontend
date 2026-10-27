import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApi } from '@/hooks/use-api';

const { auth } = vi.hoisted(() => ({
  auth: { token: 'tok-123' as string | null, logout: vi.fn() },
}));
vi.mock('@/lib/auth/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('@/lib/config-provider', () => ({
  useConfig: () => ({ apiBaseUrl: 'https://api.test', environment: 'test' }),
}));

const ok = () => new Response(JSON.stringify({ targets: [] }), { status: 200 });
const unauthorized = () => new Response(JSON.stringify({ error: 'expired' }), { status: 401 });

beforeEach(() => {
  auth.token = 'tok-123';
  auth.logout.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('useApi', () => {
  it('calls the lab API with the logged-in user token', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useApi());
    await result.current.getTargets();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/targets');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('logs out as "expired" on a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unauthorized()),
    );
    const { result } = renderHook(() => useApi());

    await expect(result.current.getTargets()).rejects.toMatchObject({ status: 401 });

    expect(auth.logout).toHaveBeenCalledWith('expired');
  });

  it('logs out only once when several requests fail with 401 together', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unauthorized()),
    );
    const { result } = renderHook(() => useApi());

    await Promise.allSettled([
      result.current.getTargets(),
      result.current.getScan('a'),
      result.current.getFindings('p', 'SAST'),
    ]);

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('keeps the same API object until the token changes', () => {
    const { result, rerender } = renderHook(() => useApi());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    auth.token = 'tok-456';
    rerender();
    expect(result.current).not.toBe(first);
  });
});
