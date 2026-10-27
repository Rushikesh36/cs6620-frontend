'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatFullDateTime, formatRelativeTime, type DateInput } from '@/lib/utils/format';
import { useNow } from '@/lib/utils/use-now';

/** "3 minutes ago", with the full local date and time in a tooltip. */
export function RelativeTime({
  date,
  fallback = '—',
}: {
  date: DateInput | null | undefined;
  fallback?: string;
}) {
  const now = useNow();
  if (date === null || date === undefined)
    return <span aria-label="Not available">{fallback}</span>;

  const value = new Date(date);
  const valid = !Number.isNaN(value.getTime());
  return (
    <Tooltip>
      {/* tabIndex lets keyboard users reach the tooltip too. */}
      <TooltipTrigger asChild>
        <time
          dateTime={valid ? value.toISOString() : undefined}
          tabIndex={0}
          className="whitespace-nowrap"
        >
          {formatRelativeTime(date, now)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatFullDateTime(date)}</TooltipContent>
    </Tooltip>
  );
}
