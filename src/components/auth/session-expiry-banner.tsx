'use client';

import { Clock, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';

/** Non-blocking notice for the last 5 minutes. There is no refresh token, so it can only warn. */
export function SessionExpiryBanner() {
  const { isAuthenticated, isExpiringSoon, expiresAt } = useAuth();
  // Remember a dismissal for this session only: a new login has a new expiry, so it shows again.
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);

  if (!isAuthenticated || !isExpiringSoon || dismissedFor === expiresAt) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center justify-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <Clock className="size-4 shrink-0" aria-hidden />
      <span>Your session expires in 5 minutes.</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        onClick={() => setDismissedFor(expiresAt)}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
