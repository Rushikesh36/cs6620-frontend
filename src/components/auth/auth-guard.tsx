'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { useAuth } from '@/lib/auth/auth-provider';

/**
 * Client-side guard: this is a static site, so there is no server to turn people away.
 * It only decides what the browser shows. The real protection is that the API rejects
 * requests without a valid token.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logoutReason } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // After a logout, the logout itself is already taking the user to /login with the reason.
    if (isAuthenticated || logoutReason) return;
    const here = `${pathname}${window.location.search}`;
    router.replace(`/login/?next=${encodeURIComponent(here)}`);
  }, [isAuthenticated, logoutReason, pathname, router]);

  // Never render protected content, not even for one frame, until we know who this is.
  if (!isAuthenticated) return <FullPageLoader label="Checking your login" />;
  return <>{children}</>;
}
