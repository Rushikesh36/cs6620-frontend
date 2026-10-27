import { Badge } from '@/components/ui/badge';
import type { Severity } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';

// Colours come from the spec: HIGH red, MEDIUM orange, LOW yellow, INFO gray.
// The text label is always shown too, so colour is never the only signal.
const STYLES: Record<Severity, { label: string; className: string }> = {
  HIGH: {
    label: 'High',
    className:
      'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  },
  MEDIUM: {
    label: 'Medium',
    className:
      'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
  },
  LOW: {
    label: 'Low',
    className:
      'border-yellow-300 bg-yellow-100 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  },
  INFO: {
    label: 'Info',
    className:
      'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const style = STYLES[severity];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {style.label}
    </Badge>
  );
}
