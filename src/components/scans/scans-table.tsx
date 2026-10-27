'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CopyButton } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import type { Scan } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils/format';
import { projectHref } from '@/lib/utils/project-links';
import { scanDetailHref, scanDurationMs, shortJobId } from '@/lib/utils/scan-list';
import { useNow } from '@/lib/utils/use-now';
import { ScanTypeBadge } from './scan-type-badge';
import { StatusBadge } from './status-badge';

const TYPE_LABELS = { SAST: 'Code scan (SAST)', DAST: 'App scan (DAST)' } as const;

/** The scans as a table on wide screens, and as stacked cards on phones. */
export function ScansTable({
  scans,
  showProject = false,
}: {
  scans: Scan[];
  /** Adds a Project column, for lists that mix scans from several projects. */
  showProject?: boolean;
}) {
  const headings = [
    'Status',
    ...(showProject ? ['Project'] : []),
    'Scan type',
    'Started',
    'Duration',
    'New HIGH',
    'Requested by',
    'Job ID',
  ];

  return (
    <>
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Scans, one row for each scan</caption>
          <thead className="bg-muted/50 text-muted-foreground text-left">
            <tr>
              {headings.map((heading) => (
                <th key={heading} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {scans.map((scan) => (
              <ScanTableRow key={scan.jobId} scan={scan} showProject={showProject} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Scans">
        {scans.map((scan) => (
          <ScanCard key={scan.jobId} scan={scan} showProject={showProject} />
        ))}
      </ul>
    </>
  );
}

function ScanTableRow({ scan, showProject }: { scan: Scan; showProject: boolean }) {
  const router = useRouter();
  const href = scanDetailHref(scan.jobId);

  return (
    <tr
      className="hover:bg-muted/40 cursor-pointer"
      onClick={(event) => {
        // Clicking a link or button does its own thing. Anywhere else on the row opens the scan.
        if ((event.target as HTMLElement).closest('a, button')) return;
        router.push(href);
      }}
    >
      <td className="px-4 py-3">
        <Link
          href={href}
          className="focus-visible:ring-ring rounded-md outline-none focus-visible:ring-2"
        >
          <span className="sr-only">Open scan {shortJobId(scan.jobId)}: </span>
          <StatusBadge status={scan.status} />
        </Link>
      </td>
      {showProject && (
        <td className="px-4 py-3">
          <ProjectLink projectId={scan.projectId} />
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap">{TYPE_LABELS[scan.scanType]}</td>
      <td className="px-4 py-3">
        <RelativeTime date={scan.startedAt} fallback="Not started" />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Duration scan={scan} />
      </td>
      <td className="px-4 py-3">
        <NewHigh scan={scan} />
      </td>
      <td className="px-4 py-3">{scan.requestedBy}</td>
      <td className="px-4 py-3">
        <JobId jobId={scan.jobId} />
      </td>
    </tr>
  );
}

function ScanCard({ scan, showProject }: { scan: Scan; showProject: boolean }) {
  const router = useRouter();
  const href = scanDetailHref(scan.jobId);

  return (
    <li
      className="border-border bg-card space-y-3 rounded-xl border p-4"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a, button')) return;
        router.push(href);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href}
          className="focus-visible:ring-ring rounded-md outline-none focus-visible:ring-2"
        >
          <span className="sr-only">Open scan {shortJobId(scan.jobId)}: </span>
          <StatusBadge status={scan.status} />
        </Link>
        <ScanTypeBadge scanType={scan.scanType} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {showProject && (
          <Field label="Project">
            <ProjectLink projectId={scan.projectId} />
          </Field>
        )}
        <Field label="Started">
          <RelativeTime date={scan.startedAt} fallback="Not started" />
        </Field>
        <Field label="Duration">
          <Duration scan={scan} />
        </Field>
        <Field label="New HIGH">
          <NewHigh scan={scan} />
        </Field>
        <Field label="Requested by">{scan.requestedBy}</Field>
      </dl>
      <JobId jobId={scan.jobId} />
    </li>
  );
}

function ProjectLink({ projectId }: { projectId: string }) {
  return (
    <Link
      href={projectHref(projectId)}
      className="text-primary font-mono text-xs break-all underline-offset-4 hover:underline"
    >
      {projectId}
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function JobId({ jobId }: { jobId: string }) {
  return (
    <span className="flex items-center gap-1">
      <code className="font-mono text-xs" title={jobId}>
        {shortJobId(jobId)}
      </code>
      <CopyButton value={jobId} label="job ID" />
    </span>
  );
}

function NewHigh({ scan }: { scan: Scan }) {
  if (!scan.summary) return <span className="text-muted-foreground">—</span>;
  const count = scan.summary.newHigh;
  return (
    <span
      className={cn('tabular-nums', count > 0 && 'font-semibold text-red-700 dark:text-red-300')}
    >
      {count}
      {count > 0 && <span className="sr-only"> new high severity findings</span>}
    </span>
  );
}

/** The scanner's working time. A running scan counts up. */
function Duration({ scan }: { scan: Scan }) {
  const now = useNow(scan.status === 'RUNNING' ? 1000 : 60_000);
  const ms = scanDurationMs(scan, now);
  return ms === null ? <span className="text-muted-foreground">—</span> : <>{formatDuration(ms)}</>;
}
