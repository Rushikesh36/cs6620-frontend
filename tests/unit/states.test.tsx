import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState, errorMessage } from '@/components/common/error-state';
import { CardGridSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { ApiError } from '@/lib/api/client';

describe('EmptyState', () => {
  it('explains what is missing and offers the next step', () => {
    render(
      <EmptyState
        title="No scans yet"
        description="Start a scan to see results."
        action={<button>Start</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No scans yet' })).toBeInTheDocument();
    expect(screen.getByText('Start a scan to see results.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('shows the server message and a working Try again button', async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState error={new ApiError(500, 'The scanner service is down.')} onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The scanner service is down.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses a plain message for errors it does not know, and never leaks their text', () => {
    render(<ErrorState error={new Error('TypeError: x is undefined at line 42')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('TypeError');
  });

  it('has no retry button when there is nothing to retry', () => {
    render(<ErrorState error={new ApiError(404, 'Not found')} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('errorMessage picks the ApiError message, or a fallback', () => {
    expect(errorMessage(new ApiError(0, 'Could not reach the server.', 'network'))).toBe(
      'Could not reach the server.',
    );
    expect(errorMessage('weird')).toBe('Something went wrong. Please try again.');
    expect(errorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('skeletons', () => {
  it('announce one loading message, and hide the empty boxes from screen readers', () => {
    const { container } = render(<TableSkeleton rows={2} columns={3} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Loading table');
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('draw the requested number of rows and cards', () => {
    const table = render(<TableSkeleton rows={4} columns={2} />);
    // 1 header row + 4 body rows, 2 cells each
    expect(table.container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(10);
    table.unmount();

    const cards = render(<CardGridSkeleton cards={3} />);
    expect(cards.container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
  });
});
