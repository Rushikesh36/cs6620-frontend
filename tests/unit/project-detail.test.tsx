import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetail } from '@/components/projects/project-detail';

const { urlState, setParams } = vi.hoisted(() => ({
  urlState: { current: '' },
  setParams: vi.fn(),
}));
vi.mock('@/hooks/use-url-params', () => ({
  useUrlParams: () => ({ params: new URLSearchParams(urlState.current), setParams }),
}));
// The tab contents have their own tests: here they only show what they were given.
vi.mock('@/components/findings/findings-panel', () => ({
  FindingsPanel: ({ projectId, scanType }: { projectId: string; scanType: string }) => (
    <div data-testid="findings">{`${scanType} findings of ${projectId}`}</div>
  ),
}));
vi.mock('@/components/scans/scans-list', () => ({
  ScansList: ({ showProjectPicker }: { showProjectPicker?: boolean }) => (
    <div data-testid="history">{`history, picker ${showProjectPicker === false ? 'hidden' : 'shown'}`}</div>
  ),
}));

beforeEach(() => {
  urlState.current = 'projectId=demo-app';
  setParams.mockClear();
});

describe('ProjectDetail', () => {
  it('shows the project, a way to start a scan for it, and the three tabs', () => {
    render(<ProjectDetail />);
    expect(screen.getByText('demo-app')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a scan' }).getAttribute('href')).toMatch(
      /^\/scans\/new\/?\?project=demo-app$/,
    );
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'SAST findings',
      'DAST findings',
      'Scan history',
    ]);
  });

  it('opens on the SAST findings by default', () => {
    render(<ProjectDetail />);
    expect(screen.getByRole('tab', { name: 'SAST findings' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('findings')).toHaveTextContent('SAST findings of demo-app');
  });

  it('opens the DAST tab for the link from a finished app scan (?scanType=DAST)', () => {
    urlState.current = 'projectId=demo-app&scanType=DAST';
    render(<ProjectDetail />);
    expect(screen.getByRole('tab', { name: 'DAST findings' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('findings')).toHaveTextContent('DAST findings of demo-app');
  });

  it('opens the history tab, without the project picker, for ?tab=history', () => {
    urlState.current = 'projectId=demo-app&tab=history';
    render(<ProjectDetail />);
    expect(screen.getByRole('tab', { name: 'Scan history' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('history')).toHaveTextContent('picker hidden');
    expect(screen.queryByTestId('findings')).not.toBeInTheDocument();
  });

  it('only builds the tab you are on', () => {
    render(<ProjectDetail />);
    expect(screen.getAllByTestId('findings')).toHaveLength(1);
    expect(screen.queryByTestId('history')).not.toBeInTheDocument();
  });

  it("changing tab writes it to the address and drops the other tab's filters", async () => {
    const user = userEvent.setup();
    render(<ProjectDetail />);

    await user.click(screen.getByRole('tab', { name: 'DAST findings' }));
    expect(setParams).toHaveBeenLastCalledWith({
      severity: null,
      state: null,
      q: null,
      sort: null,
      page: null,
      status: null,
      tab: null,
      scanType: 'DAST',
    });

    await user.click(screen.getByRole('tab', { name: 'Scan history' }));
    expect(setParams).toHaveBeenLastCalledWith({
      severity: null,
      state: null,
      q: null,
      sort: null,
      page: null,
      status: null,
      tab: 'history',
      scanType: null,
    });
  });

  it('asks for a project when the link has none, or an invalid one', () => {
    for (const query of ['', 'projectId=Bad_ID']) {
      urlState.current = query;
      const { unmount } = render(<ProjectDetail />);
      expect(screen.getByRole('heading', { name: 'No project selected' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go to projects' })).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      unmount();
    }
  });
});
