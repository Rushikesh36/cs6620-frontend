'use client';

import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';
import { useConfig } from '@/lib/config-provider';

// Placeholder: replaced by the login/dashboard redirect once the route guard exists (Task 9).
// For now it doubles as a theme, config and session preview.
export default function HomePage() {
  const { apiBaseUrl, environment } = useConfig();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unified Security Hub</h1>
        <ThemeToggle />
      </div>
      <p className="text-sm">
        Loaded config: environment <code className="font-mono">{environment}</code>, API{' '}
        <code className="font-mono">{apiBaseUrl}</code>
      </p>
      <SessionPreview />
    </main>
  );
}

// Temporary: lets you try login, expiry and logout before the real login page (Task 8).
function SessionPreview() {
  const { user, isAuthenticated, expiresAt, isExpiringSoon, login, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (expiresAt === null) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const tryLogin = (username: string, password: string) => {
    setError(null);
    login(username, password).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Login failed'),
    );
  };

  return (
    <section className="border-border space-y-3 rounded-xl border p-4" aria-label="Session preview">
      <h2 className="font-semibold">Session (temporary preview)</h2>
      {isAuthenticated && user ? (
        <>
          <p className="text-sm">
            Logged in as <b>{user.username}</b> ({user.role}).{' '}
            {secondsLeft !== null && <>Session ends in {secondsLeft}s.</>}
            {isExpiringSoon && ' Expiry banner is showing.'}
          </p>
          <Button variant="outline" onClick={() => logout()}>
            Log out
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => tryLogin('demo', 'demo123')}>Log in as demo</Button>
          <Button variant="secondary" onClick={() => tryLogin('ci-bot', 'ci-bot123')}>
            Log in as ci-bot
          </Button>
          <Button variant="outline" onClick={() => tryLogin('demo', 'wrong')}>
            Try a wrong password
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
