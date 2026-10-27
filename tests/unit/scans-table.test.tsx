import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScansTable } from '@/components/scans/scans-table';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Scan } from '@/lib/api/schemas';
import { scanFixture } from './support/query-wrapper';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const scan = (overrides: Record<string, unknown>) => scanFixture(overrides) as Scan;

const completed = scan({
  jobId: '3f9a1c0e-7b2d4a51',
  status: 'COMPLETED',
  scanType: 'SAST',
  requestedBy: 'ci-bot',
  startedAt: '2026-03-01T12:00:06Z',
  finishedAt: '2026-03-01T12:02:20Z',
  summary: { new: 4, newHigh: 2, stillOpen: 1, fixed: 0 },
});
const failedEarly = scan({
  jobId: 'failed-early-job',
  status: 'FAILED',
  scanType: 'DAST',
  startedAt: null,
  finishedAt: '2026-03-01T12:00:06Z',
  summary: null,
  error: 'Could not start scanner task',
});
const clean = scan({
  jobId: 'clean-scan-job-1',
  status: 'COMPLETED',
  finishedAt: '2026-03-01T12:00:26Z',
  summary: { new: 0, newHigh: 0, stillOpen: 3, fixed: 1 },
});

const renderTable = (scans: Scan[], showProject = false) =>
  render(
    <TooltipProvider>
      <ScansTable scans={scans} showProject={showProject} />
    </TooltipProvider>,
  );
const table = () => screen.getByRole('table');
const rows = () => within(table()).getAllByRole('row').slice(1); // without the header

beforeEach(() => push.mockClear());

describe('ScansTable (wide screens)', () => {
  it('has the seven columns from the spec', () => {
    renderTable([completed]);
    const headings = within(table())
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Status',
      'Scan type',
      'Started',
      'Duration',
      'New HIGH',
      'Requested by',
      'Job ID',
    ]);
  });

  it('shows each scan on its own row', () => {
    renderTable([completed, failedEarly]);
    expect(rows()).toHaveLength(2);

    const first = within(rows()[0] as HTMLElement);
    expect(first.getByText('Completed')).toBeInTheDocument();
    expect(first.getByText('Code scan (SAST)')).toBeInTheDocument();
    expect(first.getByText('2m 14s')).toBeInTheDocument(); // 12:00:06 to 12:02:20
    expect(first.getByText('ci-bot')).toBeInTheDocument();
  });

  it('shortens the job ID, keeps the full one in a tooltip, and has a copy button', () => {
    renderTable([completed]);
    const row = within(rows()[0] as HTMLElement);
    expect(row.getByText('3f9a1c0e…')).toHaveAttribute('title', '3f9a1c0e-7b2d4a51');
    expect(row.getByRole('button', { name: 'Copy job ID' })).toBeInTheDocument();
  });

  it('shows dashes where there is nothing to show', () => {
    renderTable([failedEarly]);
    const row = within(rows()[0] as HTMLElement);
    expect(row.getByText('Not started')).toBeInTheDocument();
    expect(row.getAllByText('—')).toHaveLength(2); // duration and New HIGH
  });

  it('shows the New HIGH count, in red and in words when it is above 0', () => {
    renderTable([completed, clean]);
    const high = within(rows()[0] as HTMLElement).getByText('2');
    expect(high.className).toContain('red');
    expect(
      within(rows()[0] as HTMLElement).getByText('new high severity findings'),
    ).toBeInTheDocument();

    const zero = within(rows()[1] as HTMLElement).getByText('0');
    expect(zero.className).not.toContain('red');
  });

  it('links to the scan, and a click on the row also opens it', async () => {
    const user = userEvent.setup();
    renderTable([completed]);
    const row = rows()[0] as HTMLElement;

    expect(within(row).getByRole('link').getAttribute('href')).toMatch(
      /^\/scans\/detail\/?\?jobId=3f9a1c0e-7b2d4a51$/,
    );

    await user.click(within(row).getByText('ci-bot'));
    expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=3f9a1c0e-7b2d4a51');
  });

  it('does not open the scan when you click the copy button', async () => {
    renderTable([completed]);
    await userEvent
      .setup()
      .click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Copy job ID' }));
    expect(push).not.toHaveBeenCalled();
  });
});

describe('ScansTable with a project column', () => {
  it('adds a Project column after Status, linking to each project', () => {
    renderTable([completed], true);
    const headings = within(table())
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headings.slice(0, 3)).toEqual(['Status', 'Project', 'Scan type']);
    expect(headings).toHaveLength(8);

    const link = within(rows()[0] as HTMLElement).getByRole('link', { name: 'demo-app' });
    expect(link.getAttribute('href')).toMatch(/^\/projects\/detail\/?\?projectId=demo-app$/);
  });

  it('also shows the project on the phone cards', () => {
    renderTable([completed], true);
    const card = within(screen.getByRole('list', { name: 'Scans' })).getAllByRole(
      'listitem',
    )[0] as HTMLElement;
    expect(within(card).getByText('Project')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'demo-app' })).toBeInTheDocument();
  });

  it('has no Project column unless asked for', () => {
    renderTable([completed]);
    expect(
      within(table()).queryByRole('columnheader', { name: 'Project' }),
    ).not.toBeInTheDocument();
  });
});

describe('ScansTable (phones)', () => {
  it('shows the same scans as stacked cards', () => {
    renderTable([completed, failedEarly]);
    const cards = within(screen.getByRole('list', { name: 'Scans' })).getAllByRole('listitem');
    expect(cards).toHaveLength(2);

    const first = within(cards[0] as HTMLElement);
    expect(first.getByText('Completed')).toBeInTheDocument();
    expect(first.getByText('Code scan (SAST)')).toBeInTheDocument();
    expect(first.getByText('Requested by')).toBeInTheDocument();
    expect(first.getByText('ci-bot')).toBeInTheDocument();
    expect(first.getByText('3f9a1c0e…')).toBeInTheDocument();
    expect(first.getByRole('button', { name: 'Copy job ID' })).toBeInTheDocument();
  });

  it('opens a scan when its card is clicked', async () => {
    renderTable([completed]);
    const card = within(screen.getByRole('list', { name: 'Scans' })).getAllByRole(
      'listitem',
    )[0] as HTMLElement;
    await userEvent.setup().click(within(card).getByText('ci-bot'));
    expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=3f9a1c0e-7b2d4a51');
  });
});
