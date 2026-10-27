import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FindingsPanel } from '@/components/findings/findings-panel';
import { ApiError } from '@/lib/api/client';
import type { Finding } from '@/lib/api/schemas';

const { urlState, setParams, findingsQuery, hookArgs } = vi.hoisted(() => ({
  urlState: { current: '' },
  setParams: vi.fn(),
  findingsQuery: { current: {} as Record<string, unknown> },
  hookArgs: { current: [] as unknown[] },
}));
vi.mock('@/hooks/use-url-params', () => ({
  useUrlParams: () => ({ params: new URLSearchParams(urlState.current), setParams }),
}));
vi.mock('@/hooks/use-findings', () => ({
  useFindings: (...args: unknown[]) => {
    hookArgs.current = args;
    return findingsQuery.current;
  },
}));

let n = 0;
const finding = (overrides: Partial<Finding> = {}): Finding => ({
  fingerprint: `fp-${String(++n).padStart(5, '0')}`,
  ruleId: 'rule.generic',
  severity: 'LOW',
  location: `app/file${n}.py:1`,
  message: 'A message.',
  state: 'OPEN',
  firstSeenJobId: 'job-1',
  lastSeenJobId: 'job-2',
  ...overrides,
});

const eval_ = finding({
  ruleId: 'python.eval',
  severity: 'HIGH',
  location: 'app/views.py:42',
  message: 'Avoid eval()',
});
const md5 = finding({
  ruleId: 'python.md5',
  severity: 'MEDIUM',
  location: 'auth/tokens.py:23',
  message: 'MD5 is weak',
});
const pickle = finding({
  ruleId: 'python.pickle',
  severity: 'HIGH',
  location: 'services/cache.py:56',
  state: 'FIXED',
});
const info = finding({ ruleId: 'python.encoding', severity: 'INFO', location: 'utils/io.py:12' });

const refetch = vi.fn();
const loaded = (data: Finding[]) => {
  findingsQuery.current = { data, isPending: false, isError: false, error: null, refetch };
};
const renderPanel = (scanType: 'SAST' | 'DAST' = 'SAST') =>
  render(<FindingsPanel projectId="demo-app" scanType={scanType} />);
const rowRules = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('code')?.textContent);

beforeEach(() => {
  urlState.current = '';
  setParams.mockClear();
  refetch.mockClear();
  loaded([eval_, md5, pickle, info]);
});

describe('FindingsPanel: loading what to show', () => {
  it('asks for the findings of this project and scan type', () => {
    renderPanel('DAST');
    expect(hookArgs.current).toEqual(['demo-app', 'DAST']);
  });

  it('shows a skeleton while loading', () => {
    findingsQuery.current = {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch,
    };
    renderPanel();
    expect(screen.getByRole('status')).toHaveTextContent('Loading table');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server message and Try again when loading fails', async () => {
    findingsQuery.current = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(500, 'Findings are unavailable.'),
      refetch,
    };
    renderPanel();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Findings are unavailable.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('explains a project with no findings of this type, and offers a scan of that type', () => {
    loaded([]);
    renderPanel('DAST');
    expect(screen.getByRole('heading', { name: 'No DAST findings yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a app scan' }).getAttribute('href')).toMatch(
      /^\/scans\/new\/?\?type=DAST&project=demo-app$/,
    );
  });
});

describe('FindingsPanel: the default view', () => {
  it('shows open findings only, high severity first', () => {
    renderPanel();
    expect(rowRules()).toEqual(['python.eval', 'python.md5', 'python.encoding']);
  });

  it('counts the open findings of each severity at the top', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'High: 1 findings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium: 1 findings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Low: 0 findings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Info: 1 findings' })).toBeInTheDocument();
  });

  it('says how many findings are shown', () => {
    renderPanel();
    expect(screen.getByText('Showing 1 to 3 of 3 findings')).toBeInTheDocument();
  });
});

describe('FindingsPanel: filters from the address', () => {
  it('state=fixed shows only the fixed findings', () => {
    urlState.current = 'state=fixed';
    renderPanel();
    expect(rowRules()).toEqual(['python.pickle']);
  });

  it('state=all shows open and fixed together', () => {
    urlState.current = 'state=all';
    renderPanel();
    expect(rowRules()).toEqual(['python.eval', 'python.pickle', 'python.md5', 'python.encoding']);
  });

  it('severity=HIGH,INFO shows only those, and marks their buttons as pressed', () => {
    urlState.current = 'severity=HIGH,INFO';
    renderPanel();
    expect(rowRules()).toEqual(['python.eval', 'python.encoding']);
    expect(screen.getByRole('button', { name: /^High:/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Medium:/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps the severity counts about the other filters, so they say what a click would give', () => {
    urlState.current = 'severity=HIGH&state=all';
    renderPanel();
    expect(screen.getByRole('button', { name: 'High: 2 findings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium: 1 findings' })).toBeInTheDocument();
  });

  it('q=… searches the rule, location and message, and the counts follow it', () => {
    urlState.current = 'q=tokens';
    renderPanel();
    expect(rowRules()).toEqual(['python.md5']);
    expect(screen.getByRole('button', { name: 'High: 0 findings' })).toBeInTheDocument();
  });

  it('sort=rule', () => {
    urlState.current = 'sort=rule';
    renderPanel();
    expect(rowRules()).toEqual(['python.encoding', 'python.eval', 'python.md5']);
  });

  it('ignores values it does not know', () => {
    urlState.current = 'state=nope&sort=sideways&severity=CRITICAL&page=abc';
    renderPanel();
    expect(rowRules()).toEqual(['python.eval', 'python.md5', 'python.encoding']);
  });
});

describe('FindingsPanel: changing filters writes the address, and goes back to page 1', () => {
  it('severity', async () => {
    await userEvent.setup().click(renderAndGet(/^High:/));
    expect(setParams).toHaveBeenLastCalledWith({ severity: 'HIGH', page: null });
  });

  it('un-pressing the last severity removes it from the address', async () => {
    urlState.current = 'severity=HIGH';
    await userEvent.setup().click(renderAndGet(/^High:/));
    expect(setParams).toHaveBeenLastCalledWith({ severity: null, page: null });
  });

  it('state: "Open" is the default and leaves no trace in the address', async () => {
    urlState.current = 'state=all';
    renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('State'), 'fixed');
    expect(setParams).toHaveBeenLastCalledWith({ state: 'fixed', page: null });
    await user.selectOptions(screen.getByLabelText('State'), 'open');
    expect(setParams).toHaveBeenLastCalledWith({ state: null, page: null });
  });

  it('sort: "high first" is the default and leaves no trace', async () => {
    urlState.current = 'sort=location';
    renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Sort by'), 'rule');
    expect(setParams).toHaveBeenLastCalledWith({ sort: 'rule', page: null });
    await user.selectOptions(screen.getByLabelText('Sort by'), 'severity');
    expect(setParams).toHaveBeenLastCalledWith({ sort: null, page: null });
  });

  it('search', async () => {
    renderPanel();
    await userEvent.setup().type(screen.getByLabelText('Search'), 'md5');
    await vi.waitFor(() => expect(setParams).toHaveBeenCalledWith({ q: 'md5', page: null }));
  });

  function renderAndGet(name: RegExp) {
    renderPanel();
    return screen.getByRole('button', { name });
  }
});

describe('FindingsPanel: nothing matches', () => {
  it('says so, hints at fixed findings when only open ones are shown, and clears the filters', async () => {
    urlState.current = 'severity=LOW';
    loaded([eval_, pickle]);
    renderPanel();

    expect(
      screen.getByRole('heading', { name: 'No findings match these filters' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Only open findings are shown/)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);

    expect(setParams).toHaveBeenCalledWith({
      severity: null,
      state: null,
      q: null,
      sort: null,
      page: null,
    });
  });

  it('offers no "Clear filters" when nothing is filtered', () => {
    loaded([pickle]); // only a fixed finding, and the default view shows open ones
    renderPanel();
    expect(
      screen.getByRole('heading', { name: 'No findings match these filters' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('FindingsPanel: paging, 50 at a time', () => {
  const many = Array.from({ length: 120 }, (_, i) =>
    finding({
      ruleId: `rule-${String(i).padStart(3, '0')}`,
      location: `loc-${String(i).padStart(3, '0')}`,
    }),
  );

  it('shows the first 50 and says so', () => {
    loaded(many);
    renderPanel();
    expect(rowRules()).toHaveLength(50);
    expect(screen.getByText('Showing 1 to 50 of 120 findings')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('page=3 shows the last 20, and a page that is too big shows the last page', () => {
    loaded(many);
    urlState.current = 'page=3';
    renderPanel();
    expect(rowRules()).toHaveLength(20);
    expect(screen.getByText('Showing 101 to 120 of 120 findings')).toBeInTheDocument();

    urlState.current = 'page=99';
    renderPanel();
    expect(screen.getAllByText('Page 3 of 3').length).toBeGreaterThan(0);
  });

  it('Next and Previous write the page to the address, and page 1 leaves no trace', async () => {
    loaded(many);
    urlState.current = 'page=2';
    renderPanel();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(setParams).toHaveBeenLastCalledWith({ page: '3' });
    await user.click(screen.getByRole('button', { name: /Previous/ }));
    expect(setParams).toHaveBeenLastCalledWith({ page: null });
  });
});
