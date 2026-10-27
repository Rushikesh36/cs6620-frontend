'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FindingStateBadge } from '@/components/findings/finding-state-badge';
import { SeverityBadge } from '@/components/findings/severity-badge';
import type { Finding } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';
import { scanDetailHref, shortJobId } from '@/lib/utils/scan-list';

const HEADINGS = ['Severity', 'Rule ID', 'Location', 'Message', 'State', 'First seen', 'Last seen'];
const LONG_MESSAGE = 140;

// Rule IDs, locations and messages come from scanned code and attacked apps, so they are
// untrusted. They are only ever shown as plain text.

/** The findings as a table on wide screens, and as stacked cards on phones. */
export function FindingsTable({
  findings,
  onSelect,
}: {
  findings: Finding[];
  onSelect: (finding: Finding) => void;
}) {
  return (
    <>
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Findings, one row for each finding</caption>
          <thead className="bg-muted/50 text-muted-foreground text-left">
            <tr>
              {HEADINGS.map((heading) => (
                <th key={heading} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {findings.map((finding) => (
              <tr
                key={finding.fingerprint}
                className="hover:bg-muted/40 cursor-pointer align-top"
                onClick={(event) => {
                  // A link or button does its own thing. Anywhere else on the row opens the details.
                  if (!(event.target as HTMLElement).closest('a, button')) onSelect(finding);
                }}
              >
                <td className="px-4 py-3">
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td className="px-4 py-3">
                  <RuleButton finding={finding} onSelect={onSelect} />
                </td>
                <td className="px-4 py-3">
                  <code className="font-mono text-xs break-all">{finding.location}</code>
                </td>
                <td className="max-w-md px-4 py-3">
                  <ExpandableMessage message={finding.message} ruleId={finding.ruleId} />
                </td>
                <td className="px-4 py-3">
                  <FindingStateBadge state={finding.state} />
                </td>
                <td className="px-4 py-3">
                  <JobLink jobId={finding.firstSeenJobId} />
                </td>
                <td className="px-4 py-3">
                  <JobLink jobId={finding.lastSeenJobId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Findings">
        {findings.map((finding) => (
          <li
            key={finding.fingerprint}
            className="border-border bg-card space-y-3 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <FindingStateBadge state={finding.state} />
            </div>
            <RuleButton finding={finding} onSelect={onSelect} />
            <code className="text-muted-foreground block font-mono text-xs break-all">
              {finding.location}
            </code>
            <ExpandableMessage message={finding.message} ruleId={finding.ruleId} />
            <dl className="grid grid-cols-2 gap-x-4 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">First seen</dt>
                <dd>
                  <JobLink jobId={finding.firstSeenJobId} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Last seen</dt>
                <dd>
                  <JobLink jobId={finding.lastSeenJobId} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The rule ID is the button that opens the details, so the keyboard can reach them too. */
function RuleButton({
  finding,
  onSelect,
}: {
  finding: Finding;
  onSelect: (finding: Finding) => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => onSelect(finding)}
      className="text-primary focus-visible:ring-ring rounded text-left font-mono text-xs break-all underline-offset-4 outline-none hover:underline focus-visible:ring-2"
    >
      {finding.ruleId}
    </button>
  );
}

function JobLink({ jobId }: { jobId: string }) {
  return (
    <Link
      href={scanDetailHref(jobId)}
      title={jobId}
      className="text-primary font-mono text-xs underline-offset-4 hover:underline"
    >
      {shortJobId(jobId)}
    </Link>
  );
}

/** Long messages are cut to two lines, with a button to read the rest. */
function ExpandableMessage({ message, ruleId }: { message: string; ruleId: string }) {
  const [open, setOpen] = useState(false);
  const long = message.length > LONG_MESSAGE;

  return (
    <div className="space-y-1">
      <p className={cn('break-words', long && !open && 'line-clamp-2')}>{message}</p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="text-primary focus-visible:ring-ring rounded text-xs underline underline-offset-4 outline-none focus-visible:ring-2"
        >
          {open ? 'Show less' : 'Show more'}{' '}
          <span className="sr-only">of the {ruleId} message</span>
        </button>
      )}
    </div>
  );
}
