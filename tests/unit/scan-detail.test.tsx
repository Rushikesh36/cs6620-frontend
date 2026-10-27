import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanDetail } from '@/components/scans/scan-detail';
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
    render(<ScanDetail />);

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
    render(<ScanDetail />);
    expect(useScanMock).toHaveBeenCalledWith('my-job', { poll: true });
  });

  it('shows a skeleton while the first answer is on its way', () => {
    scanResult.current = { ...base, isPending: true };
    render(<ScanDetail />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading scan');
    expect(screen.queryByRole('list', { name: 'Scan progress' })).not.toBeInTheDocument();
  });

  it('says "Scan not found" for a 404, with a way back to the scans list', () => {
    scanResult.current = { ...base, isError: true, error: new ApiError(404, 'Scan not found.') };
    render(<ScanDetail />);
    expect(screen.getByRole('heading', { name: 'Scan not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scans' })).toHaveAttribute('href', '/scans');
  });

  it('shows the server message and Try again for other failures', async () => {
    scanResult.current = {
      ...base,
      isError: true,
      error: new ApiError(500, 'The scan service is down.'),
    };
    render(<ScanDetail />);

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
    render(<ScanDetail />);

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting...');
    expect(within(screen.getByRole('banner')).getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Scan progress' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not say "Reconnecting..." when everything is fine', () => {
    render(<ScanDetail />);
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
  });

  it('asks for a scan when the link has no job ID, and does not fetch anything', () => {
    query.current = '';
    render(<ScanDetail />);
    expect(screen.getByRole('heading', { name: 'No scan selected' })).toBeInTheDocument();
    expect(useScanMock).toHaveBeenCalledWith(null, { poll: true });
  });

  it('treats an absurdly long job ID as missing', () => {
    query.current = `jobId=${'a'.repeat(300)}`;
    render(<ScanDetail />);
    expect(screen.getByRole('heading', { name: 'No scan selected' })).toBeInTheDocument();
  });

  it('shows the job ID as text, not markup', () => {
    loaded({ jobId: '<img src=x onerror=alert(1)>' });
    render(<ScanDetail />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});
