// What the backend says when a scan fails (section 4.9), in words a developer who has never
// seen the scanner can act on. Anything we don't recognise falls back to a general sentence.
const KNOWN: { matches: (error: string) => boolean; summary: string }[] = [
  {
    matches: (error) => /^scanner exited with code \d+/i.test(error),
    summary: 'The scanner stopped with an error before it could finish.',
  },
  {
    matches: (error) => /^no report produced/i.test(error),
    summary: "The scanner finished but didn't produce a report, so there are no results.",
  },
  {
    matches: (error) => /^timed out after/i.test(error),
    summary: 'The scan ran for too long, so it was stopped.',
  },
  {
    matches: (error) => /^could not start scanner task/i.test(error),
    summary: "We couldn't start a scanner for this scan. This is usually temporary.",
  },
];

export function explainScanError(error: string | null): { summary: string; detail: string | null } {
  const detail = error?.trim() || null;
  if (!detail) return { summary: "The scan failed, but the scanner didn't say why.", detail: null };
  const known = KNOWN.find((entry) => entry.matches(detail));
  return { summary: known?.summary ?? 'The scan failed.', detail };
}
