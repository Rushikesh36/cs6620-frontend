import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** A fresh query client for each test, with retries off so failures show up immediately. */
export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

export const scanFixture = (overrides: Record<string, unknown> = {}) => ({
  jobId: 'job-1',
  projectId: 'demo-app',
  scanType: 'SAST' as const,
  targetId: null,
  status: 'RUNNING' as const,
  requestedBy: 'demo',
  imageTag: null,
  createdAt: '2026-03-01T12:00:00Z',
  queuedAt: '2026-03-01T12:00:01Z',
  startedAt: '2026-03-01T12:00:06Z',
  finishedAt: null,
  summary: null,
  error: null,
  ...overrides,
});
