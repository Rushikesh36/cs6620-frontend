import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { LoginScreen } from '@/components/auth/login-screen';

export const metadata: Metadata = { title: 'Log in · Unified Security Hub' };

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in a statically exported page.
  return (
    <Suspense fallback={<FullPageLoader />}>
      <LoginScreen />
    </Suspense>
  );
}
