import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScansList } from '@/components/scans/scans-list';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/client';
import type { Scan } from '@/lib/api/schemas';
import { readRecentProjects } from '@/lib/projects/recent-projects';
import { scanFixture } from './support/query-wrapper';

const { urlState, setParams, scansQuery, hookOptions } = vi.hoisted(() => ({
  urlState: { current: '' },
  setParams: vi.fn(),
  scansQuery: { current: {} as Record<string, unknown> },
  hookOptions: {
    current: undefined as undefined | { autoRefreshWhile?: (scans: Scan[]) => boolean },
  },
}));
vi.mock('@/hooks/use-url-params', () => ({
  useUrlParams: () => ({ params: new URLSearchParams(urlState.current), setParams }),
}));
vi.mock('@/hooks/use-project-scans', () => ({
  useProjectScans: (_project: unknown, options: typeof hookOptions.current) => {
    hookOptions.current = options;
    return scansQuery.current;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const scan = (overrides: Record<string, unknown>) => scanFixture(overrides) as Scan;
const done = scan({
  jobId: 'done-job-0001',
  status: 'COMPLETED',
  scanType: 'SAST',
  createdAt: '2026-03-01T10:00:00Z',
  summary: { new: 1, newHigh: 0, stillOpen: 0, fixed: 0 },
});
const failed = scan({
  jobId: 'fail-job-0002',
  status: 'FAILED',
  scanType: 'DAST',
  createdAt: '2026-03-01T11:00:00Z',
  error: 'x',
});
const running = scan({
  jobId: 'run-job-00003',
  status: 'RUNNING',
  scanType: 'SAST',
  createdAt: '2026-03-01T12:00:00Z',
});

const refetch = vi.fn();
const fetchNextPage = vi.fn();
const idle = {
  data: undefined,
  isPending: false,
  isError: false,
  isRefetchError: false,
  isFetchNextPageError: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  error: null,
  refetch,
  fetchNextPage,
};
const loaded = (scans: Scan[], extra: Record<string, unknown> = {}) => {
  scansQuery.current = { ...idle, data: { pages: [{ items: scans, nextCursor: null }] }, ...extra };
};

const renderList = () =>
  render(
    <TooltipProvider>
      <ScansList />
    </TooltipProvider>,
  );
const jobIdsIn = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('code')?.textContent);
const tableJobIds = () => jobIdsIn(screen.getByRole('table'));

beforeEach(() => {
  urlState.current = 'projectId=demo-app';
  setParams.mockClear();
  refetch.mockClear();
  fetchNextPage.mockClear();
  hookOptions.current = undefined;
  sessionStorage.clear();
  loaded([done, failed, running]);
});

describe('ScansList: choosing a project', () => {
  it('asks for a project when there is none, and loads nothing', () => {
    urlState.current = '';
    scansQuery.current = idle;
    renderList();
    expect(screen.getByRole('heading', { name: 'Choose a project' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('puts the chosen project in the address, so the view can be shared', async () => {
    urlState.current = '';
    scansQuery.current = idle;
    renderList();

    await userEvent.setup().type(screen.getByLabelText('Project ID'), 'web-shop{Enter}');

    expect(setParams).toHaveBeenCalledWith({ projectId: 'web-shop' });
  });

  it('says so when the project ID in the link is not valid', () => {
    urlState.current = 'projectId=Bad_ID';
    scansQuery.current = idle;
    renderList();
    expect(screen.getByRole('alert')).toHaveTextContent("The project ID in the link isn't valid.");
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('remembers a project once it has scans, for the suggestions next time', () => {
    renderList();
    expect(readRecentProjects()).toEqual(['demo-app']);
  });

  it('does not remember a project that has no scans (maybe a typo)', () => {
    loaded([]);
    renderList();
    expect(readRecentProjects()).toEqual([]);
  });
});

describe('ScansList: states', () => {
  it('shows a skeleton while loading', () => {
    scansQuery.current = { ...idle, isPending: true };
    renderList();
    expect(screen.getByRole('status')).toHaveTextContent('Loading table');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server message and Try again when loading fails', async () => {
    scansQuery.current = {
      ...idle,
      isError: true,
      error: new ApiError(500, 'The scan history is unavailable.'),
    };
    renderList();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The scan history is unavailable.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('explains an empty project and offers to start a scan for it', () => {
    loaded([]);
    renderList();
    expect(
      screen.getByRole('heading', { name: 'No scans for this project yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a scan' }).getAttribute('href')).toMatch(
      /^\/scans\/new\/?\?project=demo-app$/,
    );
  });

  it('keeps the scans on screen, with a note, when a refresh fails', () => {
    loaded([done], { isError: true, isRefetchError: true });
    renderList();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't refresh just now");
  });
});

describe('ScansList: filters and sorting', () => {
  it('shows newest first, and oldest first when asked', () => {
    renderList();
    expect(tableJobIds()).toEqual(['run-job-…', 'fail-job…', 'done-job…']);

    urlState.current = 'projectId=demo-app&sort=oldest';
    renderList();
    const order = jobIdsIn(screen.getAllByRole('table').at(-1) as HTMLElement);
    expect(order).toEqual(['done-job…', 'fail-job…', 'run-job-…']);
  });

  it('filters by scan type and by status, from the address', () => {
    urlState.current = 'projectId=demo-app&scanType=SAST';
    renderList();
    expect(tableJobIds()).toEqual(['run-job-…', 'done-job…']);
  });

  it('filters by status', () => {
    urlState.current = 'projectId=demo-app&status=FAILED';
    renderList();
    expect(tableJobIds()).toEqual(['fail-job…']);
  });

  it('ignores filter values it does not know', () => {
    urlState.current = 'projectId=demo-app&scanType=NOPE&status=<script>&sort=sideways';
    renderList();
    expect(tableJobIds()).toHaveLength(3);
    expect(screen.getByLabelText('Scan type')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getByLabelText('Sort by date')).toHaveValue('newest');
  });

  it('writes a changed filter to the address, and removes it for "All"', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    expect(setParams).toHaveBeenLastCalledWith({ status: 'FAILED' });

    await user.selectOptions(screen.getByLabelText('Scan type'), 'DAST');
    expect(setParams).toHaveBeenLastCalledWith({ scanType: 'DAST' });

    await user.selectOptions(screen.getByLabelText('Sort by date'), 'oldest');
    expect(setParams).toHaveBeenLastCalledWith({ sort: 'oldest' });
  });

  it('removes a filter from the address when set back to "All"', async () => {
    urlState.current = 'projectId=demo-app&status=FAILED';
    renderList();

    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), '');

    expect(setParams).toHaveBeenLastCalledWith({ status: null });
  });

  it('says when no loaded scan matches, and clears the filters in one click', async () => {
    urlState.current = 'projectId=demo-app&scanType=DAST&status=RUNNING';
    renderList();

    expect(
      screen.getByRole('heading', { name: 'No scans match these filters' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(setParams).toHaveBeenCalledWith({ scanType: null, status: null });
  });

  it('tells you to load more when there are older scans that might match', () => {
    urlState.current = 'projectId=demo-app&status=CREATED';
    loaded([done], { hasNextPage: true });
    renderList();
    expect(screen.getByText(/Load more to look through older ones/)).toBeInTheDocument();
  });
});

describe('ScansList: load more', () => {
  it('shows "Load more" only when there is another page, and loads it', async () => {
    renderList();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    loaded([done], { hasNextPage: true });
    renderList();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load more' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('is disabled while the next page is loading', () => {
    loaded([done], { hasNextPage: true, isFetchingNextPage: true });
    renderList();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('says so when the next page could not be loaded', () => {
    loaded([done], { hasNextPage: true, isFetchNextPageError: true });
    renderList();
    expect(screen.getByRole('alert')).toHaveTextContent("couldn't load more scans");
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();
  });
});

describe('ScansList: auto-refresh', () => {
  it('asks to refresh only while a visible scan is not finished', () => {
    renderList();
    const refreshWhile = hookOptions.current?.autoRefreshWhile;
    expect(refreshWhile?.([done, failed])).toBe(false);
    expect(refreshWhile?.([done, running])).toBe(true);
  });

  it('ignores unfinished scans that the filters hide', () => {
    urlState.current = 'projectId=demo-app&status=COMPLETED';
    renderList();
    expect(hookOptions.current?.autoRefreshWhile?.([done, running])).toBe(false);
  });

  it('tells the user it is refreshing, only while something is running', () => {
    renderList();
    expect(
      screen.getByText('Updating every 15 seconds while scans are running.'),
    ).toBeInTheDocument();

    loaded([done, failed]);
    renderList();
    expect(screen.getAllByText(/Updating every 15 seconds/)).toHaveLength(1); // still just the first render
  });
});
