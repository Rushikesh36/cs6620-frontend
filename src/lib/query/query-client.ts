import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

const MAX_RETRIES = 2;

/**
 * Retry only problems that might go away by themselves: no answer at all, a timeout, a 5xx,
 * 408 and 429. A 404, a 403 or an answer we can't read will fail the same way every time.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.kind === 'invalid_response') return false;
    const { status } = error;
    if (
      error.kind === 'http' &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429
    ) {
      return false;
    }
  }
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        // On by default. Hooks for data that never changes turn it off.
        refetchOnWindowFocus: true,
      },
      // A retried "create scan" could make two jobs, so mutations never retry on their own.
      mutations: { retry: false },
    },
  });
}
