'use client';

import { FileQuestion, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { findingsHref } from '@/lib/utils/scan-links';
import { useScan } from '@/hooks/use-scan';
import { ApiError } from '@/lib/api/client';
import { FailedScanAlert } from './failed-scan-alert';
import { ScanHeader } from './scan-header';
import { ScanMetadata } from './scan-metadata';
import { ScanTimeline } from './scan-timeline';
import { SlowScanWarning } from './slow-scan-warning';
import { SummaryCards } from './summary-cards';

const MAX_ID_LENGTH = 200;

export function ScanDetail() {
  const jobId = useSearchParams().get('jobId');
  const validId = jobId && jobId.length <= MAX_ID_LENGTH ? jobId : null;
  const {
    data: scan,
    isPending,
    isError,
    isRefetchError,
    error,
    refetch,
  } = useScan(validId, {
    poll: true,
  });

  if (!validId) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No scan selected"
        description="Open a scan from the Scans page, or start a new one."
        action={<BackToScans />}
      />
    );
  }

  if (isPending) return <DetailSkeleton />;

  // Nothing to show yet, and no good answer to fall back on.
  if (isError && !scan) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={FileQuestion}
          title="Scan not found"
          description="This scan doesn't exist, or the link is wrong. Check the job ID and try again."
          action={<BackToScans />}
        />
      );
    }
    return (
      <ErrorState title="We couldn't load this scan" error={error} onRetry={() => void refetch()} />
    );
  }

  if (!scan) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <ScanHeader scan={scan} />

      {/* A poll failed. The page keeps what it already knows and keeps trying. */}
      {isRefetchError && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Reconnecting...
        </p>
      )}

      <SlowScanWarning scan={scan} />

      {scan.status === 'FAILED' && <FailedScanAlert scan={scan} />}

      {scan.status === 'COMPLETED' && (
        <section aria-labelledby="results-title" className="space-y-4">
          <h2 id="results-title" className="text-lg font-semibold">
            Results
          </h2>
          {scan.summary ? (
            <SummaryCards summary={scan.summary} />
          ) : (
            <p className="text-muted-foreground text-sm">No summary is available for this scan.</p>
          )}
          <Button asChild>
            <Link href={findingsHref(scan)}>View findings</Link>
          </Button>
        </section>
      )}

      <section aria-label="Status timeline" className="space-y-3">
        <h2 className="text-lg font-semibold">Status</h2>
        <ScanTimeline scan={scan} />
      </section>

      <ScanMetadata scan={scan} />
    </div>
  );
}

function BackToScans() {
  return (
    <Button asChild variant="outline">
      <Link href="/scans/">Back to scans</Link>
    </Button>
  );
}

// Same shape as the loaded page, so nothing jumps when the data arrives.
function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="max-w-3xl space-y-8">
      <span className="sr-only">Loading scan</span>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div aria-hidden className="space-y-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
