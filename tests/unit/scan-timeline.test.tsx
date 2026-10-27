import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanTimeline } from '@/components/scans/scan-timeline';
import type { Scan } from '@/lib/api/schemas';
import { scanFixture } from './support/query-wrapper';

const T0 = Date.parse('2026-03-01T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 + 17_000);
});
afterEach(() => vi.useRealTimers());

const scan = (overrides: Record<string, unknown>) => scanFixture(overrides) as Scan;
const step = (index: number) => steps()[index] as HTMLElement;
const steps = () =>
  within(screen.getByRole('list', { name: 'Scan progress' })).getAllByRole('listitem');

describe('ScanTimeline', () => {
  it('has the four steps from the spec', () => {
    render(<ScanTimeline scan={scan({ status: 'CREATED', queuedAt: null, startedAt: null })} />);
    expect(steps().map((s) => s.querySelector('p')?.textContent?.split(' (')[0])).toEqual([
      'Created',
      'Queued',
      'Running',
      'Completed or failed',
    ]);
  });

  it('CREATED: the first step is the current one and the rest have not been reached', () => {
    render(<ScanTimeline scan={scan({ status: 'CREATED', queuedAt: null, startedAt: null })} />);
    expect(step(0)).toHaveAttribute('aria-current', 'step');
    expect(step(0)).toHaveTextContent('Created (current step)');
    expect(step(1)).toHaveTextContent('(not reached yet)');
    expect(step(3)).toHaveTextContent('(not reached yet)');
  });

  it('QUEUED: shows when it was created and queued, and how long between', () => {
    render(<ScanTimeline scan={scan({ status: 'QUEUED', startedAt: null })} />);
    expect(step(0)).toHaveTextContent('Created (done)');
    expect(step(1)).toHaveAttribute('aria-current', 'step');
    expect(step(1)).toHaveTextContent('1s after created');
  });

  it('RUNNING: highlights Running, pulses, and counts up "Running for ..." every second', () => {
    render(<ScanTimeline scan={scan({ status: 'RUNNING' })} />);
    expect(step(2)).toHaveAttribute('aria-current', 'step');
    expect(step(2)).toHaveTextContent('5s after queued');
    expect(step(2)).toHaveTextContent('Running for 11s'); // started at 12:00:06, now 12:00:17
    expect(step(2).querySelector('.animate-pulse')).toHaveClass('motion-reduce:animate-none');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(step(2)).toHaveTextContent('Running for 14s');
  });

  it('COMPLETED: every step is done, with the time each one took', () => {
    render(
      <ScanTimeline
        scan={scan({
          status: 'COMPLETED',
          finishedAt: '2026-03-01T12:00:26Z',
          summary: { new: 1, newHigh: 0, stillOpen: 0, fixed: 0 },
        })}
      />,
    );
    expect(steps().map((s) => s.textContent)).toEqual([
      expect.stringContaining('Created (done)'),
      expect.stringContaining('Queued (done)'),
      expect.stringContaining('Running (done)'),
      expect.stringContaining('Completed (done)'),
    ]);
    expect(step(3)).toHaveTextContent('20s after running');
    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.queryByText(/Running for/)).not.toBeInTheDocument();
    // Nothing is "current" once the scan is over.
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('FAILED while running: the last step says Failed', () => {
    render(
      <ScanTimeline
        scan={scan({
          status: 'FAILED',
          finishedAt: '2026-03-01T12:00:12Z',
          error: 'Scanner exited with code 1',
        })}
      />,
    );
    expect(step(3)).toHaveTextContent('Failed (failed)');
    expect(step(3)).toHaveTextContent('6s after running');
    expect(step(2)).toHaveTextContent('Running (done)');
  });

  it('FAILED before a scanner picked it up: Running is shown as skipped, with no time', () => {
    render(
      <ScanTimeline
        scan={scan({
          status: 'FAILED',
          startedAt: null,
          finishedAt: '2026-03-01T12:00:06Z',
          error: 'Could not start scanner task',
        })}
      />,
    );
    expect(step(2)).toHaveTextContent('Running (skipped)');
    expect(step(2).querySelector('time')).not.toBeInTheDocument();
    expect(step(3)).toHaveTextContent('Failed (failed)');
    expect(step(3)).toHaveTextContent('5s after queued'); // measured from the last step that happened
  });

  it('gives each timestamp as a machine-readable <time>', () => {
    render(<ScanTimeline scan={scan({ status: 'QUEUED', startedAt: null })} />);
    expect(step(0).querySelector('time')).toHaveAttribute('dateTime', '2026-03-01T12:00:00Z');
  });
});
