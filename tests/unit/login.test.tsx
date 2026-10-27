import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { LoginScreen } from '@/components/auth/login-screen';
import { ApiError } from '@/lib/api/client';

const { replace, auth, query } = vi.hoisted(() => ({
  replace: vi.fn(),
  auth: { isAuthenticated: false, login: vi.fn() },
  query: { current: '' },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query.current),
}));
vi.mock('@/lib/auth/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  username: string,
  password: string,
) {
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

beforeEach(() => {
  replace.mockClear();
  vi.mocked(toast).mockClear();
  auth.isAuthenticated = false;
  auth.login.mockReset();
  auth.login.mockResolvedValue({ username: 'demo', role: 'user' });
  query.current = '';
});

describe('LoginScreen', () => {
  it('shows the product name, a description and both labelled fields', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Unified Security Hub')).toBeInTheDocument();
    expect(screen.getByText(/Scan your code and running apps/)).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('has one top heading, and a main area, for screen readers', () => {
    render(<LoginScreen />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Unified Security Hub' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('asks for both fields and does not call the server when they are empty', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillAndSubmit(user, '', '');

    expect(await screen.findByText('Enter your username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('treats a username made only of spaces as empty', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await fillAndSubmit(user, '   ', 'pw');
    expect(await screen.findByText('Enter your username.')).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('submits with the Enter key', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('Username'), 'demo');
    await user.type(screen.getByLabelText('Password'), 'demo123{Enter}');

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('demo', 'demo123'));
  });

  it('disables the button and shows a spinner while logging in, so it cannot be sent twice', async () => {
    let finish: () => void = () => {};
    auth.login.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillAndSubmit(user, 'demo', 'demo123');

    const busy = await screen.findByRole('button', { name: 'Logging in…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(auth.login).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled());
  });

  it('says "Wrong username or password." on a 401, without saying which one was wrong', async () => {
    auth.login.mockRejectedValue(new ApiError(401, 'No such user "demo"'));
    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillAndSubmit(user, 'demo', 'nope');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Wrong username or password.');
    expect(alert).not.toHaveTextContent('No such user');
  });

  it('shows the message for other failures, such as being offline', async () => {
    auth.login.mockRejectedValue(
      new ApiError(
        0,
        'Could not reach the server. Check your internet connection and try again.',
        'network',
      ),
    );
    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillAndSubmit(user, 'demo', 'demo123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('uses a plain message for an unexpected error', async () => {
    auth.login.mockRejectedValue(new Error('boom: secret internals'));
    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillAndSubmit(user, 'demo', 'demo123');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    expect(alert).not.toHaveTextContent('boom');
  });

  it('clears an old error when you try again', async () => {
    auth.login.mockRejectedValueOnce(new ApiError(401, 'x'));
    const user = userEvent.setup();
    render(<LoginScreen />);
    await fillAndSubmit(user, 'demo', 'nope');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    auth.login.mockImplementation(() => new Promise(() => {}));
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('can show and hide the password', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    const password = screen.getByLabelText('Password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('explains an expired session', () => {
    query.current = 'reason=expired';
    render(<LoginScreen />);
    expect(screen.getByText('Your session expired, please log in again.')).toBeInTheDocument();
  });

  it('confirms a manual logout with a toast, not a banner', () => {
    query.current = 'reason=signed-out';
    render(<LoginScreen />);
    expect(toast).toHaveBeenCalledWith('You have been logged out.', { id: 'signed-out' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores unknown reasons', () => {
    query.current = 'reason=<script>alert(1)</script>';
    render(<LoginScreen />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('LoginScreen redirects', () => {
  it('sends a logged-in user to the dashboard without showing the form', () => {
    auth.isAuthenticated = true;
    render(<LoginScreen />);

    expect(replace).toHaveBeenCalledWith('/dashboard/');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('goes back to the page the user wanted (?next=)', () => {
    auth.isAuthenticated = true;
    query.current = 'next=%2Fscans%2Fdetail%2F%3FjobId%3Dabc';
    render(<LoginScreen />);
    expect(replace).toHaveBeenCalledWith('/scans/detail/?jobId=abc');
  });

  it('ignores a ?next= that points to another site', () => {
    auth.isAuthenticated = true;
    query.current = 'next=https%3A%2F%2Fevil.example';
    render(<LoginScreen />);
    expect(replace).toHaveBeenCalledWith('/dashboard/');
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('evil'));
  });
});
