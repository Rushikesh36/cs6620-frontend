import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FindingDrawer } from '@/components/findings/finding-drawer';
import type { Finding } from '@/lib/api/schemas';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const finding: Finding = {
  fingerprint: 'abcdef0123456789'.repeat(4),
  ruleId: 'python.lang.security.audit.eval-detected',
  severity: 'HIGH',
  location: 'app/views.py:42',
  message: 'Detected the use of eval().\nThis can run any code.',
  state: 'FIXED',
  firstSeenJobId: '3f9a1c0e-7b2d4a51',
  lastSeenJobId: 'job-2',
};

describe('FindingDrawer', () => {
  it('shows nothing when there is no finding', () => {
    render(<FindingDrawer finding={null} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the whole finding in a dialog', () => {
    render(<FindingDrawer finding={finding} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Finding details' });

    expect(within(dialog).getByText('High')).toBeInTheDocument();
    expect(within(dialog).getByText('Fixed')).toBeInTheDocument();
    expect(
      within(dialog).getByText('python.lang.security.audit.eval-detected'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('app/views.py:42')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Detected the use of eval(). This can run any code.');
    expect(within(dialog).getByText('abcdef0123456789'.repeat(4))).toBeInTheDocument();
  });

  it('has a copy button for the fingerprint', () => {
    render(<FindingDrawer finding={finding} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Copy fingerprint' })).toBeInTheDocument();
  });

  it('links to the first and last scan that saw it, with the full job ID', () => {
    render(<FindingDrawer finding={finding} onClose={() => {}} />);
    const first = screen.getByRole('link', { name: '3f9a1c0e-7b2d4a51' });
    expect(first.getAttribute('href')).toMatch(/^\/scans\/detail\/?\?jobId=3f9a1c0e-7b2d4a51$/);
    expect(screen.getByRole('link', { name: 'job-2' }).getAttribute('href')).toMatch(
      /jobId=job-2$/,
    );
  });

  it('closes with Escape and with the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FindingDrawer finding={finding} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows hostile text as text, never as markup', () => {
    const evil = '<img src=x onerror=alert(1)>';
    render(
      <FindingDrawer
        finding={{ ...finding, ruleId: evil, location: evil, message: evil }}
        onClose={() => {}}
      />,
    );
    expect(screen.getAllByText(evil)).toHaveLength(3);
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});
