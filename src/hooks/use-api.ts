'use client';

import { useMemo } from 'react';
import { createApiClient } from '@/lib/api/client';
import { createEndpoints, type Endpoints } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/auth-provider';
import { useConfig } from '@/lib/config-provider';

/** The API functions, already pointed at this lab's URL and carrying the user's token. */
export function useApi(): Endpoints {
  const { apiBaseUrl } = useConfig();
  const { token, logout } = useAuth();

  return useMemo(() => {
    // Several requests can fail with 401 at once. Log out once, not once each.
    const state = { loggedOut: false };
    return createEndpoints(
      createApiClient({
        baseUrl: apiBaseUrl,
        getToken: () => token,
        onUnauthorized: () => {
          if (state.loggedOut) return;
          state.loggedOut = true;
          logout('expired');
        },
      }),
    );
  }, [apiBaseUrl, token, logout]);
}
