import { RelativeTime } from '@/components/common/relative-time';
import type { Scan } from '@/lib/api/schemas';

export function ScanMetadata({ scan }: { scan: Scan }) {
  return (
    <section aria-labelledby="details-title" className="space-y-3">
      <h2 id="details-title" className="text-lg font-semibold">
        Details
      </h2>
      <dl className="border-border divide-border divide-y rounded-xl border text-sm">
        <Row label="Requested by" value={scan.requestedBy} />
        <Row
          label="Scanner image"
          value={
            scan.imageTag ? (
              <span className="font-mono break-all">{scan.imageTag}</span>
            ) : (
              'Not assigned yet'
            )
          }
        />
        <Row label="Created" value={<RelativeTime date={scan.createdAt} />} />
        <Row
          label="Started"
          value={<RelativeTime date={scan.startedAt} fallback="Not started yet" />}
        />
        <Row
          label="Finished"
          value={<RelativeTime date={scan.finishedAt} fallback="Not finished yet" />}
        />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
      <dt className="text-muted-foreground w-36 shrink-0">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
