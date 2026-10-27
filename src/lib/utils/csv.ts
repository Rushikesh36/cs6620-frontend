import { format } from 'date-fns';
import type { Finding, ScanType } from '@/lib/api/schemas';

// A cell that starts with one of these is run as a formula by Excel and Google Sheets.
// Finding text comes from scanned code and attacked apps, so it can't be trusted to avoid that.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One value, ready for a CSV file (RFC 4180): wrapped in quotes when it holds a comma, a quote or
 * a line break, with quotes doubled. A leading ' is added to anything a spreadsheet would run as
 * a formula, so opening the file can't run code.
 */
export function escapeCsvField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n') + '\r\n';
}

const FINDING_HEADER = [
  'Severity',
  'Rule ID',
  'Location',
  'Message',
  'State',
  'First seen (job ID)',
  'Last seen (job ID)',
  'Fingerprint',
];

export function findingsToCsv(findings: Finding[]): string {
  return buildCsv(
    FINDING_HEADER,
    findings.map((f) => [
      f.severity,
      f.ruleId,
      f.location,
      f.message,
      f.state,
      f.firstSeenJobId,
      f.lastSeenJobId,
      f.fingerprint,
    ]),
  );
}

/** "findings-demo-app-sast-2026-03-01.csv" */
export function findingsFilename(
  projectId: string,
  scanType: ScanType,
  date: Date = new Date(),
): string {
  const safeProject = projectId.replace(/[^a-z0-9-]/gi, '-');
  return `findings-${safeProject}-${scanType.toLowerCase()}-${format(date, 'yyyy-MM-dd')}.csv`;
}
