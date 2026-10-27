'use client';

import { Check, Circle, CircleDashed, X } from 'lucide-react';
import type { Scan } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';
import { formatDuration, formatFullDateTime } from '@/lib/utils/format';
import { useNow } from '@/lib/utils/use-now';

type StepState = 'done' | 'active' | 'failed' | 'pending' | 'skipped';
type Step = { key: string; label: string; at: string | null; state: StepState };

/** Created > Queued > Running > Completed or Failed, and where this scan is on that road. */
function buildSteps(scan: Scan): Step[] {
  const current =
    scan.status === 'CREATED'
      ? 0
      : scan.status === 'QUEUED'
        ? 1
        : scan.status === 'RUNNING'
          ? 2
          : 3;
  const isFinal = scan.status === 'COMPLETED' || scan.status === 'FAILED';

  const base = [
    { key: 'created', label: 'Created', at: scan.createdAt },
    { key: 'queued', label: 'Queued', at: scan.queuedAt },
    { key: 'running', label: 'Running', at: scan.startedAt },
    {
      key: 'final',
      label: scan.status === 'FAILED' ? 'Failed' : isFinal ? 'Completed' : 'Completed or failed',
      at: scan.finishedAt,
    },
  ];

  return base.map((step, index): Step => {
    let state: StepState = 'pending';
    if (index < current) {
      // A scan that failed before a scanner picked it up never ran: that step was skipped.
      state = step.at ? 'done' : 'skipped';
    } else if (index === current) {
      state = isFinal ? (scan.status === 'FAILED' ? 'failed' : 'done') : 'active';
    }
    return { ...step, state };
  });
}

const STATE_WORDS: Record<StepState, string> = {
  done: 'done',
  active: 'current step',
  failed: 'failed',
  pending: 'not reached yet',
  skipped: 'skipped',
};

export function ScanTimeline({ scan }: { scan: Scan }) {
  const steps = buildSteps(scan);

  return (
    <ol aria-label="Scan progress" className="space-y-0">
      {steps.map((step, index) => {
        // How long this step took to arrive after the one before it that has a time.
        const before = steps
          .slice(0, index)
          .reverse()
          .find((earlier) => earlier.at);
        const wait = step.at && before?.at ? Date.parse(step.at) - Date.parse(before.at) : null;

        return (
          <li
            key={step.key}
            aria-current={step.state === 'active' ? 'step' : undefined}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {/* The line down to the next step. */}
            {index < steps.length - 1 && (
              <span aria-hidden className="bg-border absolute top-8 bottom-0 left-[15px] w-px" />
            )}
            <Marker state={step.state} running={scan.status === 'RUNNING'} />
            <div
              className={cn('min-w-0 pt-1', step.state === 'pending' && 'text-muted-foreground')}
            >
              <p className={cn('font-medium', step.state === 'active' && 'text-primary')}>
                {step.label}
                <span className="sr-only"> ({STATE_WORDS[step.state]})</span>
              </p>
              {step.at && (
                <p className="text-muted-foreground text-sm">
                  <time dateTime={step.at}>{formatFullDateTime(step.at)}</time>
                  {before && wait !== null && (
                    <>
                      {' '}
                      · {formatDuration(wait)} after {before.label.toLowerCase()}
                    </>
                  )}
                </p>
              )}
              {step.key === 'running' && scan.status === 'RUNNING' && scan.startedAt && (
                <RunningFor startedAt={scan.startedAt} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "Running for 3m 12s", counting up every second. */
function RunningFor({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  return (
    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
      Running for {formatDuration(now - Date.parse(startedAt))}
    </p>
  );
}

function Marker({ state, running }: { state: StepState; running: boolean }) {
  const base = 'flex size-8 shrink-0 items-center justify-center rounded-full border-2';
  switch (state) {
    case 'done':
      return (
        <span
          className={cn(
            base,
            'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500 dark:text-green-950',
          )}
        >
          <Check className="size-4" aria-hidden />
        </span>
      );
    case 'failed':
      return (
        <span
          className={cn(
            base,
            'border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500 dark:text-red-950',
          )}
        >
          <X className="size-4" aria-hidden />
        </span>
      );
    case 'active':
      return (
        <span
          className={cn(
            base,
            'border-primary text-primary bg-background',
            // A gentle pulse while a scanner is working. Off for people who asked for less motion.
            running && 'animate-pulse motion-reduce:animate-none',
          )}
        >
          <Circle className="size-3 fill-current" aria-hidden />
        </span>
      );
    case 'skipped':
      return (
        <span className={cn(base, 'border-border text-muted-foreground border-dashed')}>
          <CircleDashed className="size-4" aria-hidden />
        </span>
      );
    default:
      return <span className={cn(base, 'border-border')} aria-hidden />;
  }
}
