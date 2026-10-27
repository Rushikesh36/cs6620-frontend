'use client';

import { useEffect, useState } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { useConfig } from '@/lib/config-provider';

/**
 * With NEXT_PUBLIC_USE_MOCKS=true, starts the fake API before the app renders.
 * Otherwise it renders children straight away, and the mock code is left out of the build:
 * the check below is replaced by `false` at build time, so the import is never bundled.
 */
export function MockGate({ children }: { children: React.ReactNode }) {
  const { apiBaseUrl } = useConfig();
  const mocksOn = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
  const [state, setState] = useState<'starting' | 'ready' | 'failed'>(
    mocksOn ? 'starting' : 'ready',
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
      import('@/mocks/browser')
        .then((mocks) => mocks.startMocks(apiBaseUrl))
        .then(
          () => setState('ready'),
          () => setState('failed'),
        );
    }
  }, [apiBaseUrl]);

  if (state === 'starting') return <FullPageLoader label="Starting the mock API" />;
  if (state === 'failed') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="max-w-md text-center">
          The mock API could not start. Check that{' '}
          <code className="font-mono">public/mockServiceWorker.js</code> exists, or turn mocks off
          by removing NEXT_PUBLIC_USE_MOCKS.
        </p>
      </main>
    );
  }
  return (
    <>
      {children}
      {mocksOn && (
        <div className="bg-muted text-muted-foreground border-border fixed bottom-2 left-2 z-50 rounded-full border px-3 py-1 text-xs">
          Mock API
        </div>
      )}
    </>
  );
}
