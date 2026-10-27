import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanDetail } from '@/components/scans/scan-detail';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/client';
import { scanFixture } from './support/query-wrapper';

const { query, scanResult, useScanMock } = vi.hoisted(() => ({
  query: { current: 'jobId=job-1' },
  scanResult: { current: {} as Record<string, unknown> },
  useScanMock: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query.current) }));
vi.mock('@/hooks/use-scan', () => ({
  useScan: (...args: unknown[]) => {
    useScanMock(...args);
    return scanResult.current;
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const refetch = vi.fn();
const base = {
  data: undefined,
  isPending: false,
  isError: false,
  isRefetchError: false,
  error: null,
  refetch,
};
const loaded = (overrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
  scanResult.current = { ...base, data: scanFixture(overrides), ...extra };
};

// The app sets this up once in the root layout.
const renderDetail = () =>
  render(
    <TooltipProvider>
      <ScanDetail />
    </TooltipProvider>,
  );

beforeEach(() => {
  query.current = 'jobId=job-1';
  useScanMock.mockClear();
  refetch.mockClear();
  loaded();
});

describe('ScanDetail', () => {
  it('shows the job ID with a copy button, the status, the type and a link to the project', () => {
    loaded({
      jobId: 'abc-123',
      projectId: 'demo-app',
      status: 'RUNNING',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    renderDetail();

    expect(screen.getByText('abc-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy job ID' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('App scan (DAST)')).toBeInTheDocument();
    // Next adds the trailing slash itself at runtime (trailingSlash is set in next.config.ts).
    expect(screen.getByRole('link', { name: 'demo-app' }).getAttribute('href')).toMatch(
      /^\/projects\/detail\/?\?projectId=demo-app$/,
    );
    expect(screen.getByText('juice-shop')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Scan progress' })).toBeInTheDocument();
  });

  it('polls the scan named in the link', () => {
    query.current = 'jobId=my-job';
    renderDetail();
    expect(useScanMock).toHaveBeenCalledWith('my-job', { poll: true });
  });

  it('shows a skeleton while the first answer is on its way', () => {
    scanResult.current = { ...base, isPending: true };
    renderDetail();
    expect(screen.getByRole('status')).toHaveTextContent('Loading scan');
    expect(screen.queryByRole('list', { name: 'Scan progress' })).not.toBeInTheDocument();
  });

  it('says "Scan not found" for a 404, with a way back to the scans list', () => {
    scanResult.current = { ...base, isError: true, error: new ApiError(404, 'Scan not found.') };
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Scan not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scans' })).toHaveAttribute('href', '/scans');
  });

  it('shows the server message and Try again for other failures', async () => {
    scanResult.current = {
      ...base,
      isError: true,
      error: new ApiError(500, 'The scan service is down.'),
    };
    renderDetail();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The scan service is down.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps showing the scan, and says "Reconnecting...", when a later poll fails', () => {
    loaded(
      { status: 'RUNNING' },
      { isError: true, isRefetchError: true, error: new ApiError(0, 'x', 'network') },
    );
    renderDetail();

    expect(screen.getByText('Reconnecting...').closest('[role="status"]')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Scan progress' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not say "Reconnecting..." when everything is fine', () => {
    renderDetail();
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
  });

  it('asks for a scan when the link has no job ID, and does not fetch anything', () => {
    query.current = '';
    renderDetail();
    expect(screen.getByRole('heading', { name: 'No scan selected' })).toBeInTheDocument();
    expect(useScanMock).toHaveBeenCalledWith(null, { poll: true });
  });

  it('treats an absurdly long job ID as missing', () => {
    query.current = `jobId=${'a'.repeat(300)}`;
    renderDetail();
    expect(screen.getByRole('heading', { name: 'No scan selected' })).toBeInTheDocument();
  });

  it('shows the job ID as text, not markup', () => {
    loaded({ jobId: '<img src=x onerror=alert(1)>' });
    renderDetail();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  describe('by status', () => {
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

    it('COMPLETED: shows the results and a "View findings" link for this project and scan type', () => {
      loaded({
        status: 'COMPLETED',
        scanType: 'DAST',
        projectId: 'web-shop',
        finishedAt: '2026-03-01T12:00:26Z',
        summary: { new: 3, newHigh: 1, stillOpen: 5, fixed: 2 },
      });
      renderDetail();

      expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
      expect(screen.getByLabelText('Scan results')).toHaveTextContent('New HIGH');
      expect(screen.getByRole('link', { name: 'View findings' }).getAttribute('href')).toMatch(
        /^\/projects\/detail\/?\?projectId=web-shop&scanType=DAST$/,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('FAILED: shows the red box and the run-again link, and no results', () => {
      loaded({
        status: 'FAILED',
        error: 'Scanner exited with code 1',
        finishedAt: '2026-03-01T12:00:26Z',
      });
      renderDetail();

      expect(screen.getByRole('alert')).toHaveTextContent('This scan failed.');
      expect(screen.getByRole('link', { name: 'Start the same scan again' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'View findings' })).not.toBeInTheDocument();
    });

    it('RUNNING for 26 minutes: shows the "taking longer than usual" warning', () => {
      loaded({ status: 'RUNNING', startedAt: minutesAgo(26) });
      renderDetail();
      expect(screen.getByText(/This is taking longer than usual/)).toBeInTheDocument();
    });

    it('RUNNING for a minute: shows neither the warning nor results', () => {
      loaded({ status: 'RUNNING', startedAt: minutesAgo(1) });
      renderDetail();
      expect(screen.queryByText(/taking longer than usual/)).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('always shows the details section', () => {
      loaded({ requestedBy: 'demo' });
      renderDetail();
      expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
      expect(screen.getByText('Requested by')).toBeInTheDocument();
    });
  });
});
