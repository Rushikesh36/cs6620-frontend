'use client';

import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { createQueryClient } from './query-client';

/**
 * Cached server data, plus login. They are set up together because logging out must empty
 * the cache: the next person to log in on this tab must never see the previous person's data.
 */
export function SessionProviders({ children }: { children: React.ReactNode }) {
  // useState so the client is created once per page load, not on every render.
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthWithCache>{children}</AuthWithCache>
    </QueryClientProvider>
  );
}

function AuthWithCache({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  return <AuthProvider onLogout={() => queryClient.clear()}>{children}</AuthProvider>;
}
