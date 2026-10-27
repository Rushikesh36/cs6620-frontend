import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelativeTime } from '@/components/common/relative-time';
import { TooltipProvider } from '@/components/ui/tooltip';

const NOW = Date.parse('2026-03-01T12:00:00Z');

const renderTime = (date: Parameters<typeof RelativeTime>[0]['date']) =>
  render(
    <TooltipProvider>
      <RelativeTime date={date} />
    </TooltipProvider>,
  );

afterEach(() => vi.useRealTimers());

describe('RelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
  });

  it('shows a relative time in a <time> element with the exact moment', () => {
    renderTime(new Date(NOW - 3 * 60_000).toISOString());
    const time = screen.getByText('3 minutes ago');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', new Date(NOW - 3 * 60_000).toISOString());
  });

  it('can be reached with the keyboard, and shows the full date and time on focus', async () => {
    vi.useRealTimers(); // user-event and the tooltip animations need real timers
    const user = userEvent.setup();
    renderTime(new Date(2026, 0, 15, 9, 30, 0));

    await user.tab();

    const tooltips = await screen.findAllByText(/Jan 15, 2026/);
    expect(tooltips.length).toBeGreaterThan(0);
  });

  it('keeps counting: "3 minutes ago" becomes "4 minutes ago"', () => {
    renderTime(new Date(NOW - 3 * 60_000).toISOString());
    expect(screen.getByText('3 minutes ago')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('4 minutes ago')).toBeInTheDocument();
  });

  it('shows a dash when there is no date', () => {
    renderTime(null);
    expect(screen.getByLabelText('Not available')).toHaveTextContent('—');
  });
});
