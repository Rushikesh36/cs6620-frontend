import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Scan } from '@/lib/api/schemas';
import { explainScanError } from '@/lib/utils/scan-errors';
import { rerunHref } from '@/lib/utils/scan-links';

export function FailedScanAlert({ scan }: { scan: Scan }) {
  const { summary, detail } = explainScanError(scan.error);

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-3">
        <p className="font-semibold">This scan failed.</p>
        <p>{summary}</p>
        {detail && (
          <p className="text-sm">
            Scanner message: <span className="font-mono break-words">{detail}</span>
          </p>
        )}
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm" className="bg-background text-foreground">
            <Link href={rerunHref(scan)}>Start the same scan again</Link>
          </Button>
          {scan.scanType === 'SAST' && (
            <p className="text-sm">You will need to choose your .zip file again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
