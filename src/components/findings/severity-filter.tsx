'use client';

import { SeverityBadge } from '@/components/findings/severity-badge';
import type { Severity } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';
import { SEVERITY_ORDER } from '@/lib/utils/findings';

const NAMES: Record<Severity, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

/**
 * The count for each severity, which are also the severity filter: press one or more to show
 * only those. The numbers follow the other filters, so they say how many you would get.
 */
export function SeverityFilter({
  counts,
  selected,
  onChange,
}: {
  counts: Record<Severity, number>;
  selected: Severity[];
  onChange: (selected: Severity[]) => void;
}) {
  const toggle = (severity: Severity) =>
    onChange(
      SEVERITY_ORDER.filter((s) => (s === severity ? !selected.includes(s) : selected.includes(s))),
    );

  return (
    <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-3">
      {SEVERITY_ORDER.map((severity) => {
        const active = selected.includes(severity);
        return (
          <button
            key={severity}
            type="button"
            aria-pressed={active}
            aria-label={`${NAMES[severity]}: ${counts[severity]} findings`}
            onClick={() => toggle(severity)}
            className={cn(
              'focus-visible:ring-ring flex items-center gap-3 rounded-xl border-2 px-4 py-2 outline-none focus-visible:ring-2',
              active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}
          >
            <SeverityBadge severity={severity} />
            <span className="text-2xl font-semibold tabular-nums">
              {formatNumber(counts[severity])}
            </span>
          </button>
        );
      })}
    </div>
  );
}
