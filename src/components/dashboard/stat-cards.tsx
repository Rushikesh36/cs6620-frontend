import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';
import type { DashboardStats } from '@/lib/utils/dashboard';

export function StatCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      label: 'Scans in the last 7 days',
      value: stats.scansLast7Days,
      hint: 'Started by anyone in your projects',
    },
    { label: 'Running now', value: stats.running, hint: 'A scanner is working on them' },
    { label: 'Failed in the last 7 days', value: stats.failedLast7Days, hint: 'Worth a look' },
    {
      label: 'New HIGH findings',
      value: stats.newHighRecent,
      hint: 'In your 10 most recent scans',
      urgent: true,
    },
  ];

  return (
    <dl aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, hint, urgent }) => {
        const alarming = urgent && value > 0;
        return (
          <div
            key={label}
            className={cn(
              'space-y-1 rounded-xl border p-4',
              alarming
                ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                : 'border-border bg-card',
            )}
          >
            <dt className="text-sm font-medium">{label}</dt>
            <dd className="text-3xl font-semibold tabular-nums">{formatNumber(value)}</dd>
            <p className={cn('text-xs', alarming ? 'font-medium' : 'text-muted-foreground')}>
              {alarming ? (
                <span className="inline-flex items-center gap-1">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  Needs attention
                </span>
              ) : (
                hint
              )}
            </p>
          </div>
        );
      })}
    </dl>
  );
}
