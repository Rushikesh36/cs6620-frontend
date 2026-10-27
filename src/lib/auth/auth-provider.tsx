'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createApiClient } from '@/lib/api/client';
import { createEndpoints } from '@/lib/api/endpoints';
import type { User } from '@/lib/api/schemas';
import { useConfig } from '@/lib/config-provider';
import { computeExpiresAt } from './jwt';
import { clearSession, isExpiringSoon, readSession, writeSession, type Session } from './session';

/** Why the user was logged out. The login page uses it to pick a message. */
export type LogoutReason = 'expired' | 'signed-out';

export type AuthContextValue = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** When the session ends, in ms since 1970. */
  expiresAt: number | null;
  /** True during the last 5 minutes of the session. */
  isExpiringSoon: boolean;
  /** Throws an ApiError when the login fails (a 401 means wrong username or password). */
  login: (username: string, password: string) => Promise<User>;
  logout: (reason?: LogoutReason) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  /** Runs on every logout, for example to clear cached server data. */
  onLogout?: () => void;
}) {
  const { apiBaseUrl } = useConfig();
  const router = useRouter();

  // Safe to read storage in the initial state: ConfigProvider only renders its children in the
  // browser, after config.json has loaded, so this never runs during the server prerender.
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [expiringSoon, setExpiringSoon] = useState(() =>
    session ? isExpiringSoon(session.expiresAt) : false,
  );

  const onLogoutRef = useRef(onLogout);
  useEffect(() => {
    onLogoutRef.current = onLogout;
  });

  const logout = useCallback(
    (reason: LogoutReason = 'signed-out') => {
      clearSession();
      setSession(null);
      setExpiringSoon(false);
      onLogoutRef.current?.();
      router.replace(`/login/?reason=${reason}`);
    },
    [router],
  );

  // Login has no token yet, so it uses a client without one.
  const loginEndpoint = useMemo(
    () =>
      createEndpoints(
        createApiClient({ baseUrl: apiBaseUrl, getToken: () => null, onUnauthorized: () => {} }),
      ).login,
    [apiBaseUrl],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginEndpoint({ username, password });
      const next: Session = {
        token: result.token,
        user: result.user,
        expiresAt: computeExpiresAt(result.token, result.expiresIn, Date.now()),
      };
      writeSession(next);
      setSession(next);
      setExpiringSoon(isExpiringSoon(next.expiresAt));
      return next.user;
    },
    [loginEndpoint],
  );

  // Watch the clock. A check every second (rather than one long timer) still works after a
  // laptop sleeps, and setting an unchanged value does not re-render anything.
  const expiresAt = session?.expiresAt ?? null;
  useEffect(() => {
    if (expiresAt === null) return;
    // A second tick can fire before React has torn this effect down, so log out only once.
    let done = false;
    const check = () => {
      if (done) return;
      const now = Date.now();
      if (expiresAt <= now) {
        done = true;
        logout('expired');
      } else {
        setExpiringSoon(isExpiringSoon(expiresAt, now));
      }
    };
    const timer = setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [expiresAt, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: session !== null,
      expiresAt,
      isExpiringSoon: expiringSoon,
      login,
      logout,
    }),
    [session, expiresAt, expiringSoon, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
