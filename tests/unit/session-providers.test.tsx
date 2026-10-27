import { useQueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth, type AuthContextValue } from '@/lib/auth/auth-provider';
import { SessionProviders } from '@/lib/query/query-provider';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/config-provider', () => ({
  useConfig: () => ({ apiBaseUrl: 'https://api.test', environment: 'test' }),
}));

let auth!: AuthContextValue;
let cache!: ReturnType<typeof useQueryClient>;
function Probe() {
  const authValue = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    auth = authValue;
    cache = queryClient;
  });
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('SessionProviders', () => {
  it('empties the query cache on logout, so the next user never sees old data', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ exp }))}.sig`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ token, expiresIn: 3600, user: { username: 'demo', role: 'user' } }),
          ),
      ),
    );
    render(
      <SessionProviders>
        <Probe />
      </SessionProviders>,
    );
    await act(async () => {
      await auth.login('demo', 'demo123');
    });
    cache.setQueryData(['scans', 'job-1'], { jobId: 'job-1' });
    expect(cache.getQueryData(['scans', 'job-1'])).toBeDefined();

    act(() => auth.logout());

    expect(cache.getQueryData(['scans', 'job-1'])).toBeUndefined();
    expect(cache.getQueryCache().getAll()).toHaveLength(0);
  });
});
