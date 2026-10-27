'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Page settings kept in the address bar, so a link or a reload brings the same view back.
 * `setParams({ status: 'FAILED', type: null })` sets one and removes the other.
 * Needs a Suspense boundary around the page (static export).
 */
export function useUrlParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  return { params, setParams };
}
