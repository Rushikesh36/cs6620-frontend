import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '@/components/dashboard/dashboard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/client';
import type { Scan } from '@/lib/api/schemas';
import { scanFixture } from './support/query-wrapper';

const { recentProjects, recentScans, scansHookArgs } = vi.hoisted(() => ({
  recentProjects: { current: [] as string[] },
  recentScans: { current: {} as Record<string, unknown> },
  scansHookArgs: { current: [] as unknown[] },
}));
vi.mock('@/hooks/use-recent-projects', () => ({
  useRecentProjects: () => ({ projects: recentProjects.current, remember: vi.fn() }),
}));
vi.mock('@/hooks/use-recent-scans', () => ({
  useRecentScans: (...args: unknown[]) => {
    scansHookArgs.current = args;
    return recentScans.current;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
let n = 0;
const scan = (overrides: Record<string, unknown>) =>
  scanFixture({
    jobId: `dash-job-${String(++n).padStart(4, '0')}`,
    createdAt: minutesAgo(5),
    ...overrides,
  }) as Scan;

const refetchAll = vi.fn();
const settled = {
  scans: [] as Scan[],
  isPending: false,
  projectCount: 1,
  failedCount: 0,
  allFailed: false,
  error: null,
  refetchAll,
};
const withScans = (scans: Scan[], extra: Record<string, unknown> = {}) => {
  recentScans.current = { ...settled, scans, ...extra };
};

const renderDashboard = () =>
  render(
    <TooltipProvider>
      <Dashboard />
    </TooltipProvider>,
  );

beforeEach(() => {
  recentProjects.current = ['demo-app'];
  scansHookArgs.current = [];
  refetchAll.mockClear();
  withScans([]);
});

describe('Dashboard: first visit', () => {
  beforeEach(() => {
    recentProjects.current = [];
  });

  it('explains code scans and app scans, and invites you to start the first one', () => {
    renderDashboard();
    expect(
      screen.getByRole('heading', { name: 'Welcome to Unified Security Hub' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Code scan (SAST)')).toBeInTheDocument();
    expect(
      screen.getByText(/We read it for risky patterns without ever running it/),
    ).toBeInTheDocument();
    expect(screen.getByText('App scan (DAST)')).toBeInTheDocument();
    expect(screen.getByText(/the way a hacker would/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Start your first scan' }).getAttribute('href'),
    ).toMatch(/^\/scans\/new\/?$/);
  });

  it('loads nothing, because there is nothing to ask about', () => {
    renderDashboard();
    expect(scansHookArgs.current).toEqual([]); // the content (and its hook) is not shown at all
    expect(screen.queryByLabelText('Summary')).not.toBeInTheDocument();
  });
});

describe('Dashboard: with projects', () => {
  it('always has a "Start a scan" button', () => {
    renderDashboard();
    expect(screen.getAllByRole('link', { name: 'Start a scan' })[0]?.getAttribute('href')).toMatch(
      /^\/scans\/new\/?$/,
    );
  });

  it('asks for the scans of the recent projects', () => {
    recentProjects.current = ['demo-app', 'web-shop'];
    renderDashboard();
    expect(scansHookArgs.current).toEqual([['demo-app', 'web-shop']]);
  });

  it('shows the four summary numbers from the scans', () => {
    withScans([
      scan({ status: 'RUNNING' }),
      scan({ status: 'FAILED', finishedAt: minutesAgo(1), error: 'x' }),
      scan({ status: 'COMPLETED', summary: { new: 3, newHigh: 2, stillOpen: 0, fixed: 0 } }),
      scan({ status: 'COMPLETED', summary: { new: 1, newHigh: 1, stillOpen: 0, fixed: 0 } }),
    ]);
    renderDashboard();

    const summary = screen.getByLabelText('Summary');
    const card = (label: string) =>
      screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(card('Scans in the last 7 days')).getByText('4')).toBeInTheDocument();
    expect(within(card('Running now')).getByText('1')).toBeInTheDocument();
    expect(within(card('Failed in the last 7 days')).getByText('1')).toBeInTheDocument();
    expect(within(card('New HIGH findings')).getByText('3')).toBeInTheDocument();
    expect(summary.querySelectorAll('dt')).toHaveLength(4);
  });

  it('turns New HIGH red, and says so in words, when there are some', () => {
    withScans([
      scan({ status: 'COMPLETED', summary: { new: 1, newHigh: 1, stillOpen: 0, fixed: 0 } }),
    ]);
    renderDashboard();
    const card = screen.getByText('New HIGH findings', { selector: 'dt' })
      .parentElement as HTMLElement;
    expect(card.className).toContain('red');
    expect(within(card).getByText('Needs attention')).toBeInTheDocument();
  });

  it('keeps New HIGH plain when there are none', () => {
    withScans([
      scan({ status: 'COMPLETED', summary: { new: 1, newHigh: 0, stillOpen: 0, fixed: 0 } }),
    ]);
    renderDashboard();
    const card = screen.getByText('New HIGH findings', { selector: 'dt' })
      .parentElement as HTMLElement;
    expect(card.className).not.toContain('red');
  });

  it('lists the 10 newest scans with their project, and says where they come from', () => {
    withScans(
      Array.from({ length: 13 }, (_, i) =>
        scan({ createdAt: minutesAgo(i + 1), projectId: i % 2 ? 'web-shop' : 'demo-app' }),
      ),
    );
    renderDashboard();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11); // header + 10
    expect(within(table).getByRole('columnheader', { name: 'Project' })).toBeInTheDocument();
    expect(
      screen.getByText(/The latest 10 scans from the projects you have used in this browser tab/),
    ).toBeInTheDocument();
  });

  it('lists the recent projects as links, with a link to all of them', () => {
    recentProjects.current = ['demo-app', 'web-shop'];
    withScans([scan({})]);
    renderDashboard();

    const section = screen.getByRole('region', { name: 'Recent projects' });
    expect(within(section).getByRole('link', { name: 'web-shop' }).getAttribute('href')).toMatch(
      /projectId=web-shop$/,
    );
    expect(within(section).getByRole('link', { name: 'All projects' })).toBeInTheDocument();
  });

  it('says so when the recent projects have no scans yet', () => {
    renderDashboard();
    expect(
      screen.getByRole('heading', { name: 'No scans yet in your recent projects' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Summary')).getAllByText('0')).toHaveLength(4);
  });
});

describe('Dashboard: loading and errors', () => {
  it('shows skeletons while the scans load', () => {
    recentScans.current = { ...settled, isPending: true };
    renderDashboard();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server message and Try again when nothing could be loaded', async () => {
    recentScans.current = {
      ...settled,
      allFailed: true,
      failedCount: 1,
      error: new ApiError(500, 'The scan history is down.'),
    };
    renderDashboard();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The scan history is down.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(refetchAll).toHaveBeenCalledTimes(1);
  });

  it('shows what it has, and a warning, when only some projects failed', async () => {
    recentProjects.current = ['demo-app', 'web-shop', 'other-app'];
    withScans([scan({})], { failedCount: 1, projectCount: 3 });
    renderDashboard();

    expect(screen.getByRole('table')).toBeInTheDocument();
    const note = screen
      .getByText(/couldn't load the scans of 1 of your 3 projects/)
      .closest('[role="status"]') as HTMLElement;
    expect(note).toHaveTextContent('the numbers below are incomplete');
    await userEvent.setup().click(within(note).getByRole('button', { name: 'Try again' }));
    expect(refetchAll).toHaveBeenCalledTimes(1);
  });
});
