import { CircleCheck, CircleDot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FindingState } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';

const STYLES: Record<FindingState, string> = {
  OPEN: 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  FIXED:
    'border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
};

export function FindingStateBadge({ state }: { state: FindingState }) {
  const Icon = state === 'FIXED' ? CircleCheck : CircleDot;
  return (
    <Badge variant="outline" className={cn(STYLES[state])}>
      <Icon aria-hidden />
      {state === 'FIXED' ? 'Fixed' : 'Open'}
    </Badge>
  );
}
