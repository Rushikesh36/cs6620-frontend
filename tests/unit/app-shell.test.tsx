import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/layout/app-shell';

const { auth, pathname } = vi.hoisted(() => ({
  auth: {
    user: { username: 'demo', role: 'user' } as { username: string; role: 'user' | 'ci' } | null,
    isAuthenticated: true,
    isExpiringSoon: false,
    expiresAt: 1,
    logout: vi.fn(),
  },
  pathname: { current: '/dashboard/' },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/auth/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('@/lib/config-provider', () => ({
  useConfig: () => ({ apiBaseUrl: 'https://api.test', environment: 'rushikesh-lab' }),
}));
// The real toggle reads window.matchMedia, which jsdom doesn't have.
vi.mock('@/components/theme/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

const renderShell = () =>
  render(
    <AppShell>
      <p>page content</p>
    </AppShell>,
  );

beforeEach(() => {
  auth.user = { username: 'demo', role: 'user' };
  auth.isExpiringSoon = false;
  auth.logout.mockClear();
  pathname.current = '/dashboard/';
});

describe('AppShell', () => {
  it('shows the product name, the environment badge and the username', () => {
    renderShell();
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Unified Security Hub')).toBeInTheDocument();
    expect(within(header).getByText('rushikesh-lab')).toBeInTheDocument();
    expect(within(header).getByText('demo')).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('shows a "CI account" badge for ci users only', () => {
    const { unmount } = renderShell();
    expect(screen.queryByText('CI account')).not.toBeInTheDocument();
    unmount();

    auth.user = { username: 'ci-bot', role: 'ci' };
    renderShell();
    expect(screen.getByText('CI account')).toBeInTheDocument();
  });

  it('logs out with the header button', async () => {
    renderShell();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out demo' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('lists the four sidebar links and marks the current page', () => {
    pathname.current = '/scans/new/';
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');

    // Next adds the trailing slash itself at runtime (trailingSlash is set in next.config.ts),
    // but not under Vitest, so compare without it.
    const hrefs = links.map((link) => [
      link.textContent,
      link.getAttribute('href')?.replace(/\/$/, ''),
    ]);
    expect(hrefs).toEqual([
      ['Dashboard', '/dashboard'],
      ['New Scan', '/scans/new'],
      ['Scans', '/scans'],
      ['Projects', '/projects'],
    ]);
    expect(within(nav).getByRole('link', { name: 'New Scan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Scans' })).not.toHaveAttribute('aria-current');
  });

  it('has a skip link and a focusable main area', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('opens a slide-out menu with the same links, and closes it after choosing one', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = await screen.findByRole('dialog');
    const links = within(dialog).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'New Scan',
      'Scans',
      'Projects',
    ]);
    expect(within(dialog).getByText('Logged in as demo')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', { name: 'Projects' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the session-expiry banner above the header when the session is about to end', () => {
    auth.isExpiringSoon = true;
    renderShell();
    expect(screen.getByText('Your session expires in 5 minutes.')).toBeInTheDocument();
  });
});
