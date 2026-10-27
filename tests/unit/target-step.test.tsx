import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetStep } from '@/components/scans/new-scan/target-step';
import { ApiError } from '@/lib/api/client';

const { targets } = vi.hoisted(() => ({
  targets: {
    current: {} as Record<string, unknown>,
  },
}));
vi.mock('@/hooks/use-targets', () => ({ useTargets: () => targets.current }));

const juiceShop = {
  targetId: 'juice-shop',
  name: 'OWASP Juice Shop',
  description: 'Deliberately vulnerable test app',
};
const refetch = vi.fn();

function loaded(list: unknown[]) {
  targets.current = { data: list, isPending: false, isError: false, error: null, refetch };
}

function renderStep(props: Partial<Parameters<typeof TargetStep>[0]> = {}) {
  const handlers = { onChange: vi.fn(), onBack: vi.fn(), onContinue: vi.fn() };
  render(<TargetStep value={null} {...handlers} {...props} />);
  return handlers;
}

beforeEach(() => {
  refetch.mockReset();
  loaded([juiceShop]);
});

describe('TargetStep', () => {
  it('always explains why the list is limited', () => {
    renderStep();
    expect(
      screen.getByText('For safety, you can only scan test apps registered by the team.'),
    ).toBeInTheDocument();
  });

  it('shows each registered test app as a card with its name, description and ID', () => {
    renderStep();
    const card = screen.getByRole('radio', { name: /OWASP Juice Shop/ });
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Deliberately vulnerable test app')).toBeInTheDocument();
    expect(screen.getByText('juice-shop')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); // there is no way to type a URL
  });

  it('cannot continue until an app is chosen, then reports the choice', async () => {
    const user = userEvent.setup();
    const handlers = renderStep();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /OWASP Juice Shop/ }));
    expect(handlers.onChange).toHaveBeenCalledWith('juice-shop');
  });

  it('enables Continue once the chosen app is on the list', async () => {
    const user = userEvent.setup();
    const handlers = renderStep({ value: 'juice-shop' });
    expect(screen.getByRole('radio', { name: /OWASP Juice Shop/ })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledTimes(1);
  });

  it('ignores a pre-selected app that is not on the allow-list', () => {
    renderStep({ value: 'http://evil.example' });
    expect(screen.getByRole('radio', { name: /OWASP Juice Shop/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('goes back', async () => {
    const handlers = renderStep();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }));
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });

  it('works with the keyboard: arrow keys move between apps', async () => {
    loaded([juiceShop, { targetId: 'webgoat', name: 'WebGoat', description: 'Training app' }]);
    const handlers = renderStep();
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('radio', { name: /Juice Shop/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');

    expect(handlers.onChange).toHaveBeenCalledWith('webgoat');
  });

  it('shows a loading skeleton that matches the cards while fetching', () => {
    targets.current = { data: undefined, isPending: true, isError: false, error: null, refetch };
    renderStep();
    expect(screen.getByRole('status')).toHaveTextContent('Loading test apps');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('shows the server message and a retry button when loading fails', async () => {
    targets.current = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(500, 'The target list is unavailable.'),
      refetch,
    };
    renderStep();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load the test apps");
    expect(alert).toHaveTextContent('The target list is unavailable.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('says so when no test apps are registered', () => {
    loaded([]);
    renderStep();
    expect(screen.getByText('No test apps are registered yet.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
