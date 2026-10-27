import { TriangleAlert } from 'lucide-react';
import type { ScanSummary } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';

const CARDS: { key: keyof ScanSummary; label: string; hint: string }[] = [
  { key: 'new', label: 'New', hint: 'Not in the previous scan' },
  { key: 'newHigh', label: 'New HIGH', hint: 'New findings with high severity' },
  { key: 'stillOpen', label: 'Still open', hint: 'Seen before and not fixed yet' },
  { key: 'fixed', label: 'Fixed', hint: 'In the previous scan, gone now' },
];

export function SummaryCards({ summary }: { summary: ScanSummary }) {
  return (
    <dl aria-label="Scan results" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, label, hint }) => {
        const value = summary[key];
        // New HIGH findings are the ones that trigger the email alert, so they stand out.
        const urgent = key === 'newHigh' && value > 0;
        return (
          <div
            key={key}
            className={cn(
              'space-y-1 rounded-xl border p-4',
              urgent
                ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                : 'border-border bg-card',
            )}
          >
            <dt className="text-sm font-medium">{label}</dt>
            <dd className="text-3xl font-semibold tabular-nums">{formatNumber(value)}</dd>
            <p className={cn('text-xs', urgent ? 'font-medium' : 'text-muted-foreground')}>
              {urgent ? (
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
