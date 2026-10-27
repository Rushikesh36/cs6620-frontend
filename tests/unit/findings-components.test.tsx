import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '@/components/common/pagination';
import { FindingStateBadge } from '@/components/findings/finding-state-badge';
import { FindingsFilters } from '@/components/findings/findings-filters';
import { FindingsTable } from '@/components/findings/findings-table';
import { SeverityFilter } from '@/components/findings/severity-filter';
import type { Finding, Severity } from '@/lib/api/schemas';

const finding = (overrides: Partial<Finding> = {}): Finding => ({
  fingerprint: 'f'.repeat(64),
  ruleId: 'python.lang.security.audit.eval-detected',
  severity: 'HIGH',
  location: 'app/views.py:42',
  message: 'Detected the use of eval().',
  state: 'OPEN',
  firstSeenJobId: '3f9a1c0e-7b2d4a51',
  lastSeenJobId: 'job-2',
  ...overrides,
});

describe('FindingStateBadge', () => {
  it('says Open or Fixed in words', () => {
    const { rerender } = render(<FindingStateBadge state="OPEN" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    rerender(<FindingStateBadge state="FIXED" />);
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });
});

describe('FindingsTable', () => {
  it('has the seven columns from the spec', () => {
    render(<FindingsTable findings={[finding()]} onSelect={() => {}} />);
    const headings = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Severity',
      'Rule ID',
      'Location',
      'Message',
      'State',
      'First seen',
      'Last seen',
    ]);
  });

  it('shows each finding with its badges, texts and links to the scans that saw it', () => {
    render(
      <FindingsTable
        findings={[finding({ state: 'FIXED', severity: 'MEDIUM' })]}
        onSelect={() => {}}
      />,
    );
    const row = within(screen.getAllByRole('row')[1] as HTMLElement);

    expect(row.getByText('Medium')).toBeInTheDocument();
    expect(row.getByText('Fixed')).toBeInTheDocument();
    expect(row.getByText('python.lang.security.audit.eval-detected')).toBeInTheDocument();
    expect(row.getByText('app/views.py:42')).toBeInTheDocument();
    expect(row.getByText('Detected the use of eval().')).toBeInTheDocument();

    const first = row.getByRole('link', { name: '3f9a1c0e…' });
    expect(first.getAttribute('href')).toMatch(/^\/scans\/detail\/?\?jobId=3f9a1c0e-7b2d4a51$/);
    expect(first).toHaveAttribute('title', '3f9a1c0e-7b2d4a51');
    expect(row.getByRole('link', { name: 'job-2' }).getAttribute('href')).toMatch(/jobId=job-2$/);
  });

  it('cuts a long message short, and shows all of it on request', async () => {
    const long = 'This is a very long explanation. '.repeat(10).trim();
    render(<FindingsTable findings={[finding({ message: long })]} onSelect={() => {}} />);
    const row = within(screen.getAllByRole('row')[1] as HTMLElement);
    const toggle = row.getByRole('button', { name: /Show more/ });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(row.getByText(long)).toHaveClass('line-clamp-2');

    await userEvent.setup().click(toggle);

    expect(row.getByRole('button', { name: /Show less/ })).toHaveAttribute('aria-expanded', 'true');
    expect(row.getByText(long)).not.toHaveClass('line-clamp-2');
  });

  it('gives a short message no toggle', () => {
    render(<FindingsTable findings={[finding()]} onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
  });

  it('describes which message a toggle belongs to, for screen readers', () => {
    render(
      <FindingsTable findings={[finding({ message: 'x'.repeat(200) })]} onSelect={() => {}} />,
    );
    expect(
      screen.getAllByRole('button', {
        name: /Show more of the python\.lang\.security\.audit\.eval-detected message/,
      }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the same findings as cards on phones', () => {
    render(
      <FindingsTable
        findings={[finding(), finding({ fingerprint: 'e'.repeat(64), ruleId: 'other.rule' })]}
        onSelect={() => {}}
      />,
    );
    const cards = within(screen.getByRole('list', { name: 'Findings' })).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[1] as HTMLElement).getByText('other.rule')).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText('First seen')).toBeInTheDocument();
  });

  it('shows hostile text as text, never as markup', () => {
    const evil = '<img src=x onerror=alert(1)>';
    render(
      <FindingsTable
        findings={[finding({ ruleId: evil, location: evil, message: evil })]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getAllByText(evil).length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('FindingsTable: opening the details', () => {
  it('opens a finding from its rule ID button, which the keyboard can reach', async () => {
    const onSelect = vi.fn();
    const first = finding();
    render(<FindingsTable findings={[first]} onSelect={onSelect} />);
    const row = within(screen.getAllByRole('row')[1] as HTMLElement);

    const button = row.getByRole('button', { name: 'python.lang.security.audit.eval-detected' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    button.focus();
    await userEvent.setup().keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(first);
  });

  it('also opens it when the row is clicked, but not when a link inside is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FindingsTable findings={[finding()]} onSelect={onSelect} />);
    const row = within(screen.getAllByRole('row')[1] as HTMLElement);

    await user.click(row.getByText('app/views.py:42'));
    expect(onSelect).toHaveBeenCalledTimes(1);

    await user.click(row.getByRole('link', { name: '3f9a1c0e…' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('opens a finding from its card on phones', async () => {
    const onSelect = vi.fn();
    render(<FindingsTable findings={[finding()]} onSelect={onSelect} />);
    const card = within(screen.getByRole('list', { name: 'Findings' })).getAllByRole(
      'listitem',
    )[0] as HTMLElement;

    await userEvent
      .setup()
      .click(
        within(card).getByRole('button', { name: 'python.lang.security.audit.eval-detected' }),
      );

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('SeverityFilter', () => {
  const counts = { HIGH: 3, MEDIUM: 0, LOW: 12, INFO: 1234 };

  function Host({ onChange = vi.fn() }: { onChange?: (s: Severity[]) => void }) {
    const [selected, setSelected] = useState<Severity[]>([]);
    return (
      <SeverityFilter
        counts={counts}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          onChange(next);
        }}
      />
    );
  }

  it('shows the count for each severity, with separators', () => {
    render(<Host />);
    expect(screen.getByRole('button', { name: 'High: 3 findings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium: 0 findings' })).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('toggles severities on and off, in several at once, and reports them in a fixed order', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /^Low:/ }));
    expect(onChange).toHaveBeenLastCalledWith(['LOW']);
    expect(screen.getByRole('button', { name: /^Low:/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /^High:/ }));
    expect(onChange).toHaveBeenLastCalledWith(['HIGH', 'LOW']);

    await user.click(screen.getByRole('button', { name: /^Low:/ }));
    expect(onChange).toHaveBeenLastCalledWith(['HIGH']);
    expect(screen.getByRole('button', { name: /^Low:/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('FindingsFilters', () => {
  const setup = (props: Partial<Parameters<typeof FindingsFilters>[0]> = {}) => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <FindingsFilters
        state="open"
        sort="severity"
        query=""
        canClear={false}
        onChange={onChange}
        onClear={onClear}
        {...props}
      />,
    );
    return { onChange, onClear };
  };

  it('offers Open, Fixed and All, and Open is the default', async () => {
    const { onChange } = setup();
    const select = screen.getByLabelText('State');
    expect(select).toHaveValue('open');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Open', 'Fixed', 'All']);

    await userEvent.setup().selectOptions(select, 'fixed');
    expect(onChange).toHaveBeenCalledWith({ state: 'fixed' });
  });

  it('offers the four sort orders, with high severity first as the default', async () => {
    const { onChange } = setup();
    const select = screen.getByLabelText('Sort by');
    expect(select).toHaveValue('severity');
    await userEvent.setup().selectOptions(select, 'location');
    expect(onChange).toHaveBeenCalledWith({ sort: 'location' });
  });

  it('waits for a pause in typing, then searches once with everything typed', async () => {
    const { onChange } = setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Search'), 'eval');
    expect(onChange).not.toHaveBeenCalled(); // not one call per letter

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith({ query: 'eval' });
  });

  it('starts with the search from the address', () => {
    setup({ query: 'tokens' });
    expect(screen.getByLabelText('Search')).toHaveValue('tokens');
  });

  it('shows "Clear filters" only when something is filtered', async () => {
    const { onClear } = setup({ canClear: true });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('has no "Clear filters" when nothing is filtered', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  const props = { page: 2, pages: 3, from: 51, to: 100, total: 120, noun: 'findings' };

  it('says which items are shown, and moves between pages', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...props} onPageChange={onPageChange} />);

    expect(screen.getByText('Showing 51 to 100 of 120 findings')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Previous/ }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<Pagination {...props} page={1} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();

    rerender(<Pagination {...props} page={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('shows only the summary when everything fits on one page', () => {
    render(
      <Pagination
        page={1}
        pages={1}
        from={1}
        to={12}
        total={12}
        noun="findings"
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText('Showing 1 to 12 of 12 findings')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
