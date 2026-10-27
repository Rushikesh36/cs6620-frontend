import Link from 'next/link';
import { CopyButton } from '@/components/common/copy-button';
import type { Scan } from '@/lib/api/schemas';
import { ScanTypeBadge } from './scan-type-badge';
import { StatusBadge } from './status-badge';

export function ScanHeader({ scan }: { scan: Scan }) {
  return (
    <header className="space-y-3">
      <h1 className="text-2xl font-semibold">Scan details</h1>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <code className="bg-muted rounded px-2 py-1 font-mono text-sm break-all">{scan.jobId}</code>
        <CopyButton value={scan.jobId} label="job ID" />
        <StatusBadge status={scan.status} />
        <ScanTypeBadge scanType={scan.scanType} />
      </div>

      <p className="text-muted-foreground text-sm">
        Project:{' '}
        <Link
          href={`/projects/detail/?projectId=${encodeURIComponent(scan.projectId)}`}
          className="text-primary font-mono underline-offset-4 hover:underline"
        >
          {scan.projectId}
        </Link>
        {scan.targetId && (
          <>
            {' '}
            · Test app: <span className="font-mono">{scan.targetId}</span>
          </>
        )}
      </p>
    </header>
  );
}
