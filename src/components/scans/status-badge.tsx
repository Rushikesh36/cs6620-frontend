import { CircleCheck, CircleDashed, CircleX, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ScanStatus } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';

// Colours come from the spec: gray (created, queued), blue (running), green, red.
// The text label is always shown too, so colour is never the only signal.
const STYLES: Record<ScanStatus, { label: string; className: string }> = {
  CREATED: {
    label: 'Created',
    className:
      'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  },
  QUEUED: {
    label: 'Queued',
    className:
      'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  },
  RUNNING: {
    label: 'Running',
    className:
      'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  },
  COMPLETED: {
    label: 'Completed',
    className:
      'border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
  },
  FAILED: {
    label: 'Failed',
    className:
      'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  },
};

function StatusIcon({ status }: { status: ScanStatus }) {
  switch (status) {
    case 'CREATED':
      return <CircleDashed aria-hidden />;
    case 'QUEUED':
      return <Clock aria-hidden />;
    case 'RUNNING':
      // A pulsing dot. It stops pulsing for people who asked their system for less motion.
      return (
        <span
          aria-hidden
          className="size-2 animate-pulse rounded-full bg-blue-600 motion-reduce:animate-none dark:bg-blue-400"
        />
      );
    case 'COMPLETED':
      return <CircleCheck aria-hidden />;
    case 'FAILED':
      return <CircleX aria-hidden />;
  }
}

export function StatusBadge({ status, className }: { status: ScanStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      <StatusIcon status={status} />
      {style.label}
    </Badge>
  );
}
