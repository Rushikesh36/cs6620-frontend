'use client';

import { Info, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/auth-provider';
import { safeRedirectPath } from '@/lib/auth/redirect';

// An expired session stays on the page so it can't be missed. A manual logout is a toast.
const EXPIRED_MESSAGE = 'Your session expired, please log in again.';

export function LoginScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const destination = safeRedirectPath(params.get('next'));
  const reason = params.get('reason');
  const notice = reason === 'expired' ? EXPIRED_MESSAGE : undefined;
  const signedOut = reason === 'signed-out';

  useEffect(() => {
    // The id stops React Strict Mode (which runs effects twice in development) from showing it twice.
    if (signedOut) toast('You have been logged out.', { id: 'signed-out' });
  }, [signedOut]);

  // Also runs right after a successful login, since that makes isAuthenticated true.
  useEffect(() => {
    if (isAuthenticated) router.replace(destination);
  }, [isAuthenticated, destination, router]);

  // Never flash the form at someone who is already logged in.
  if (isAuthenticated) return <FullPageLoader label="Taking you to the dashboard" />;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="text-primary size-10" aria-hidden />
          <h1 className="text-xl font-semibold">Unified Security Hub</h1>
          <CardDescription>
            Scan your code and running apps for security problems, and review every finding in one
            place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {notice}
            </p>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
