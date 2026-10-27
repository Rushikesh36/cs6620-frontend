'use client';

import { Hourglass } from 'lucide-react';
import type { Scan } from '@/lib/api/schemas';
import { isTakingLongerThanUsual } from '@/lib/utils/slow-scan';
import { useNow } from '@/lib/utils/use-now';

/** A soft warning, not an error: the backend fails a stuck scan by itself. */
export function SlowScanWarning({ scan }: { scan: Scan }) {
  const now = useNow(10_000);
  if (!isTakingLongerThanUsual(scan, now)) return null;

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        This is taking longer than usual. If the scan is stuck, it will be marked as failed
        automatically, so you can leave this page open or come back later.
      </span>
    </p>
  );
}
