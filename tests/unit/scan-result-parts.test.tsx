import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FailedScanAlert } from '@/components/scans/failed-scan-alert';
import { ScanMetadata } from '@/components/scans/scan-metadata';
import { SlowScanWarning } from '@/components/scans/slow-scan-warning';
import { SummaryCards } from '@/components/scans/summary-cards';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Scan } from '@/lib/api/schemas';
import { scanFixture } from './support/query-wrapper';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const scan = (overrides: Record<string, unknown> = {}) => scanFixture(overrides) as Scan;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe('SummaryCards', () => {
  const cardFor = (label: string) =>
    screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;

  it('shows the four numbers from the spec', () => {
    render(<SummaryCards summary={{ new: 3, newHigh: 1, stillOpen: 5, fixed: 2 }} />);
    const list = screen.getByLabelText('Scan results');
    expect(list.querySelectorAll('dt')).toHaveLength(4);
    expect(within(cardFor('New')).getByText('3')).toBeInTheDocument();
    expect(within(cardFor('New HIGH')).getByText('1')).toBeInTheDocument();
    expect(within(cardFor('Still open')).getByText('5')).toBeInTheDocument();
    expect(within(cardFor('Fixed')).getByText('2')).toBeInTheDocument();
  });

  it('highlights New HIGH in red when it is above 0, and says so in words too', () => {
    render(<SummaryCards summary={{ new: 3, newHigh: 2, stillOpen: 0, fixed: 0 }} />);
    expect(cardFor('New HIGH').className).toContain('red');
    expect(within(cardFor('New HIGH')).getByText('Needs attention')).toBeInTheDocument();
    expect(cardFor('New').className).not.toContain('red');
  });

  it('keeps New HIGH plain when it is 0', () => {
    render(<SummaryCards summary={{ new: 3, newHigh: 0, stillOpen: 0, fixed: 0 }} />);
    expect(cardFor('New HIGH').className).not.toContain('red');
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
  });

  it('puts separators in large numbers', () => {
    render(<SummaryCards summary={{ new: 12345, newHigh: 0, stillOpen: 1000000, fixed: 0 }} />);
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });
});

describe('FailedScanAlert', () => {
  it('explains the error in plain words and keeps the scanner message', () => {
    render(<FailedScanAlert scan={scan({ status: 'FAILED', error: 'No report produced' })} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This scan failed.');
    expect(alert).toHaveTextContent("The scanner finished but didn't produce a report");
    expect(alert).toHaveTextContent('Scanner message: No report produced');
  });

  it('offers "Start the same scan again" with the project, type and test app filled in', () => {
    render(
      <FailedScanAlert
        scan={scan({
          status: 'FAILED',
          error: 'x',
          scanType: 'DAST',
          targetId: 'juice-shop',
          projectId: 'web-shop',
        })}
      />,
    );
    const link = screen.getByRole('link', { name: 'Start the same scan again' });
    expect(link.getAttribute('href')).toMatch(
      /^\/scans\/new\/?\?type=DAST&project=web-shop&target=juice-shop$/,
    );
    expect(screen.queryByText(/choose your \.zip file again/)).not.toBeInTheDocument();
  });

  it('reminds you to pick the zip again for a code scan', () => {
    render(
      <FailedScanAlert
        scan={scan({ status: 'FAILED', error: 'x', scanType: 'SAST', projectId: 'demo-app' })}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Start the same scan again' }).getAttribute('href'),
    ).toMatch(/\?type=SAST&project=demo-app$/);
    expect(screen.getByText('You will need to choose your .zip file again.')).toBeInTheDocument();
  });

  it('copes with a failure that has no message', () => {
    render(<FailedScanAlert scan={scan({ status: 'FAILED', error: null })} />);
    expect(screen.getByRole('alert')).toHaveTextContent("the scanner didn't say why");
    expect(screen.queryByText(/Scanner message/)).not.toBeInTheDocument();
  });

  it('shows the scanner message as text, not markup', () => {
    render(
      <FailedScanAlert scan={scan({ status: 'FAILED', error: '<img src=x onerror=alert(1)>' })} />,
    );
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('SlowScanWarning', () => {
  const message = /This is taking longer than usual/;

  it('shows after 25 minutes of running', () => {
    render(<SlowScanWarning scan={scan({ status: 'RUNNING', startedAt: minutesAgo(26) })} />);
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('status')).toHaveTextContent('marked as failed automatically');
  });

  it('shows after 10 minutes in the queue', () => {
    render(
      <SlowScanWarning
        scan={scan({ status: 'QUEUED', queuedAt: minutesAgo(11), startedAt: null })}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('stays hidden for a scan that is on time, or finished', () => {
    const { rerender } = render(
      <SlowScanWarning scan={scan({ status: 'RUNNING', startedAt: minutesAgo(2) })} />,
    );
    expect(screen.queryByText(message)).not.toBeInTheDocument();

    rerender(
      <SlowScanWarning
        scan={scan({ status: 'QUEUED', queuedAt: minutesAgo(9), startedAt: null })}
      />,
    );
    expect(screen.queryByText(message)).not.toBeInTheDocument();

    rerender(<SlowScanWarning scan={scan({ status: 'COMPLETED', startedAt: minutesAgo(90) })} />);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });
});

describe('ScanMetadata', () => {
  it('shows who asked, the scanner image and the times', () => {
    render(
      <TooltipProvider>
        <ScanMetadata
          scan={scan({
            requestedBy: 'ci-bot',
            imageTag: 'semgrep-1.4.0-abc1234',
            createdAt: minutesAgo(10),
            startedAt: minutesAgo(9),
            finishedAt: minutesAgo(8),
          })}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText('ci-bot')).toBeInTheDocument();
    expect(screen.getByText('semgrep-1.4.0-abc1234')).toBeInTheDocument();
    expect(screen.getByText('10 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('9 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('8 minutes ago')).toBeInTheDocument();
  });

  it('says so when something has not happened yet', () => {
    render(
      <TooltipProvider>
        <ScanMetadata scan={scan({ imageTag: null, startedAt: null, finishedAt: null })} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Not assigned yet')).toBeInTheDocument();
    expect(screen.getByText('Not started yet')).toBeInTheDocument();
    expect(screen.getByText('Not finished yet')).toBeInTheDocument();
  });
});
