'use client';

import Link from 'next/link';
import { CopyButton } from '@/components/common/copy-button';
import { FindingStateBadge } from '@/components/findings/finding-state-badge';
import { SeverityBadge } from '@/components/findings/severity-badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Finding } from '@/lib/api/schemas';
import { scanDetailHref } from '@/lib/utils/scan-list';

/** Everything about one finding in a panel on the right. All text is shown as plain text. */
export function FindingDrawer({
  finding,
  onClose,
}: {
  finding: Finding | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={finding !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {finding && (
          <>
            <SheetHeader>
              <SheetTitle>Finding details</SheetTitle>
              <SheetDescription>What was found, where, and which scans saw it.</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={finding.severity} />
                <FindingStateBadge state={finding.state} />
              </div>

              <dl className="space-y-4 text-sm">
                <Item label="Rule ID">
                  <code className="font-mono break-all">{finding.ruleId}</code>
                </Item>
                <Item label="Location">
                  <code className="font-mono break-all">{finding.location}</code>
                </Item>
                <Item label="Message">
                  <p className="break-words whitespace-pre-wrap">{finding.message}</p>
                </Item>
                <Item label="Fingerprint">
                  <span className="flex items-start gap-1">
                    <code className="font-mono text-xs break-all">{finding.fingerprint}</code>
                    <CopyButton value={finding.fingerprint} label="fingerprint" />
                  </span>
                  <p className="text-muted-foreground mt-1 text-xs">
                    The same bug has the same fingerprint in every scan.
                  </p>
                </Item>
                <Item label="First seen in scan">
                  <ScanLink jobId={finding.firstSeenJobId} />
                </Item>
                <Item label="Last seen in scan">
                  <ScanLink jobId={finding.lastSeenJobId} />
                </Item>
              </dl>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ScanLink({ jobId }: { jobId: string }) {
  return (
    <Link
      href={scanDetailHref(jobId)}
      className="text-primary font-mono break-all underline-offset-4 hover:underline"
    >
      {jobId}
    </Link>
  );
}
