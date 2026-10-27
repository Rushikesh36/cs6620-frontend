import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionExpiryBanner } from '@/components/auth/session-expiry-banner';
import { ApiError } from '@/lib/api/client';
import { AuthProvider, useAuth, type AuthContextValue } from '@/lib/auth/auth-provider';
import { writeSession } from '@/lib/auth/session';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/config-provider', () => ({
  useConfig: () => ({ apiBaseUrl: 'https://api.test', environment: 'test' }),
}));

const START = Date.parse('2026-03-01T12:00:00Z');
const MINUTE = 60_000;

function fakeJwt(expSeconds: number): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode({ exp: expSeconds })}.sig`;
}

function loginResponse(expiresInSeconds: number, role: 'user' | 'ci' = 'user') {
  return new Response(
    JSON.stringify({
      token: fakeJwt(START / 1000 + expiresInSeconds),
      expiresIn: expiresInSeconds,
      user: { username: 'demo', role },
    }),
    { status: 200 },
  );
}

// The latest auth value, so tests can call login/logout like a component would.
let auth!: AuthContextValue;
function Probe() {
  const value = useAuth();
  useEffect(() => {
    auth = value;
  });
  return <p>{value.isAuthenticated ? `in:${value.user?.username}` : 'out'}</p>;
}

function renderAuth(onLogout?: () => void) {
  return render(
    <AuthProvider onLogout={onLogout}>
      <SessionExpiryBanner />
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  sessionStorage.clear();
  replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AuthProvider', () => {
  it('starts logged out when nothing is stored', () => {
    renderAuth();
    expect(screen.getByText('out')).toBeInTheDocument();
    expect(auth.token).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('login stores the session in sessionStorage and exposes user and token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => loginResponse(3600)),
    );
    renderAuth();

    await act(async () => {
      await auth.login('demo', 'demo123');
    });

    expect(screen.getByText('in:demo')).toBeInTheDocument();
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.token).toBeTruthy();
    expect(auth.expiresAt).toBe(START + 3600_000);
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it('login sends the credentials without an Authorization header', async () => {
    const fetchMock = vi.fn(async () => loginResponse(3600));
    vi.stubGlobal('fetch', fetchMock);
    renderAuth();

    await act(async () => {
      await auth.login('demo', 'demo123');
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/login');
    expect(init.body).toBe('{"username":"demo","password":"demo123"}');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('login passes a 401 through as an ApiError and stays logged out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Wrong username or password.' }), { status: 401 }),
      ),
    );
    renderAuth();

    const failure = act(async () => {
      await auth.login('demo', 'nope');
    });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    expect(auth.isAuthenticated).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it('restores a saved session on load', () => {
    writeSession({
      token: 't',
      user: { username: 'demo', role: 'ci' },
      expiresAt: START + 30 * MINUTE,
    });
    renderAuth();
    expect(screen.getByText('in:demo')).toBeInTheDocument();
    expect(auth.user?.role).toBe('ci');
  });

  it('ignores a saved session that has already expired', () => {
    writeSession({ token: 't', user: { username: 'demo', role: 'user' }, expiresAt: START - 1 });
    renderAuth();
    expect(screen.getByText('out')).toBeInTheDocument();
  });

  it('logout clears storage, runs onLogout and redirects to /login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => loginResponse(3600)),
    );
    const onLogout = vi.fn();
    renderAuth(onLogout);
    await act(async () => {
      await auth.login('demo', 'demo123');
    });

    act(() => auth.logout());

    expect(screen.getByText('out')).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login/?reason=signed-out');
  });

  it('logs out automatically when the token expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => loginResponse(120)),
    );
    const onLogout = vi.fn();
    renderAuth(onLogout);
    await act(async () => {
      await auth.login('demo', 'demo123');
    });

    act(() => {
      vi.advanceTimersByTime(119_000);
    });
    expect(auth.isAuthenticated).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(auth.isAuthenticated).toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login/?reason=expired');
  });
});

describe('SessionExpiryBanner', () => {
  const user = { username: 'demo', role: 'user' as const };

  it('is hidden when the session has more than 5 minutes left', () => {
    writeSession({ token: 't', user, expiresAt: START + 30 * MINUTE });
    renderAuth();
    expect(screen.queryByText('Your session expires in 5 minutes.')).not.toBeInTheDocument();
  });

  it('shows in the last 5 minutes, as a polite status message', () => {
    writeSession({ token: 't', user, expiresAt: START + 4 * MINUTE });
    renderAuth();
    const banner = screen
      .getByText('Your session expires in 5 minutes.')
      .closest('[role="status"]');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('appears once the clock reaches the last 5 minutes', () => {
    writeSession({ token: 't', user, expiresAt: START + 6 * MINUTE });
    renderAuth();
    expect(screen.queryByText('Your session expires in 5 minutes.')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByText('Your session expires in 5 minutes.')).toBeInTheDocument();
  });

  it('can be dismissed', () => {
    writeSession({ token: 't', user, expiresAt: START + 4 * MINUTE });
    renderAuth();

    act(() => screen.getByRole('button', { name: 'Dismiss' }).click());

    expect(screen.queryByText('Your session expires in 5 minutes.')).not.toBeInTheDocument();
  });

  it('is gone after logout', async () => {
    writeSession({ token: 't', user, expiresAt: START + 4 * MINUTE });
    renderAuth();
    act(() => auth.logout());
    expect(screen.queryByText('Your session expires in 5 minutes.')).not.toBeInTheDocument();
  });
});
