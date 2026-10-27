'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { useAuth } from '@/lib/auth/auth-provider';

// The site root only decides where to send you.
export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated ? '/dashboard/' : '/login/');
  }, [isAuthenticated, router]);

  return <FullPageLoader />;
}
