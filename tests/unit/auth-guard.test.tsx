import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '@/components/auth/auth-guard';
import HomePage from '@/app/page';

const { replace, auth, pathname } = vi.hoisted(() => ({
  replace: vi.fn(),
  auth: { isAuthenticated: false, logoutReason: null as string | null },
  pathname: { current: '/scans/detail/' },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname.current,
}));
vi.mock('@/lib/auth/auth-provider', () => ({ useAuth: () => auth }));

beforeEach(() => {
  replace.mockClear();
  auth.isAuthenticated = false;
  auth.logoutReason = null;
  pathname.current = '/scans/detail/';
  window.history.replaceState({}, '', '/scans/detail/');
});

describe('AuthGuard', () => {
  it('shows a loader, never the protected content, while logged out', () => {
    render(
      <AuthGuard>
        <p>secret scans</p>
      </AuthGuard>,
    );
    expect(screen.queryByText('secret scans')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('sends a logged-out visitor to /login and remembers the page, including its query', () => {
    window.history.replaceState({}, '', '/scans/detail/?jobId=abc-1');
    render(
      <AuthGuard>
        <p>secret scans</p>
      </AuthGuard>,
    );
    expect(replace).toHaveBeenCalledWith(
      `/login/?next=${encodeURIComponent('/scans/detail/?jobId=abc-1')}`,
    );
  });

  it('renders the page for a logged-in user and does not redirect', () => {
    auth.isAuthenticated = true;
    render(
      <AuthGuard>
        <p>secret scans</p>
      </AuthGuard>,
    );
    expect(screen.getByText('secret scans')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('leaves the redirect to the logout itself, so the "session expired" message survives', () => {
    auth.logoutReason = 'expired';
    render(
      <AuthGuard>
        <p>secret scans</p>
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('secret scans')).not.toBeInTheDocument();
  });
});

describe('site root', () => {
  it('goes to the dashboard when logged in', () => {
    auth.isAuthenticated = true;
    render(<HomePage />);
    expect(replace).toHaveBeenCalledWith('/dashboard/');
  });

  it('goes to the login page when logged out', () => {
    render(<HomePage />);
    expect(replace).toHaveBeenCalledWith('/login/');
  });
});
