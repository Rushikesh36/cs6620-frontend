'use client';

import { FolderSearch } from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from '@/components/common/copy-button';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PagePlaceholder } from '@/components/common/page-placeholder';
import { RelativeTime } from '@/components/common/relative-time';
import { CardGridSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { SeverityBadge } from '@/components/findings/severity-badge';
import { StatusBadge } from '@/components/scans/status-badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { severitySchema, scanStatusSchema } from '@/lib/api/schemas';
import { formatDuration, formatNumber } from '@/lib/utils/format';

export default function Page() {
  return (
    <div className="space-y-8">
      <PagePlaceholder title="Dashboard" task={22} />
      <ComponentPreview />
    </div>
  );
}

// Temporary: shows the shared components from Task 10. Task 22 replaces this page.
function ComponentPreview() {
  const [base] = useState(() => Date.now());
  const ago = (ms: number) => new Date(base - ms);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Component preview (temporary)</h2>

      <Section title="Status badges">
        {scanStatusSchema.options.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Section>

      <Section title="Severity badges">
        {severitySchema.options.map((severity) => (
          <SeverityBadge key={severity} severity={severity} />
        ))}
      </Section>

      <Section title="Relative time (hover or focus for the full date), durations, numbers">
        <RelativeTime date={ago(3000)} />
        <RelativeTime date={ago(3 * 60_000)} />
        <RelativeTime date={ago(2 * 3_600_000)} />
        <RelativeTime date={ago(3 * 86_400_000)} />
        <RelativeTime date={null} />
        <span>{formatDuration(134_000)}</span>
        <span>{formatNumber(1234567)}</span>
      </Section>

      <Section title="Copy button">
        <code className="font-mono text-sm">3f9a1c0e-7b2d</code>
        <CopyButton value="3f9a1c0e-7b2d" label="job ID" />
      </Section>

      <Section title="Empty state">
        <div className="w-full">
          <EmptyState
            icon={FolderSearch}
            title="No scans yet"
            description="Start a scan to see its results here."
            action={<Button>Start a scan</Button>}
          />
        </div>
      </Section>

      <Section title="Error state">
        <div className="w-full">
          <ErrorState
            error={new ApiError(500, 'Something went wrong on our side. Please try again.')}
            onRetry={() => {}}
          />
        </div>
      </Section>

      <Section title="Skeletons">
        <div className="w-full space-y-4">
          <CardGridSkeleton />
          <TableSkeleton rows={3} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}
