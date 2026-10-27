import { severitySchema, type Finding, type Severity } from '@/lib/api/schemas';

export const FINDINGS_PAGE_SIZE = 50;

export const SEVERITY_ORDER: Severity[] = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];
const RANK: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

export type StateFilter = 'open' | 'fixed' | 'all';
export type FindingSort = 'severity' | 'severity-asc' | 'location' | 'rule';

export type FindingFilters = {
  /** Empty means every severity. */
  severities: Severity[];
  state: StateFilter;
  query: string;
};

// ---- reading the address bar: anything unknown falls back to the default ----

export function parseSeverities(param: string | null): Severity[] {
  const wanted = new Set<Severity>();
  for (const part of (param ?? '').split(',')) {
    const parsed = severitySchema.safeParse(part.trim().toUpperCase());
    if (parsed.success) wanted.add(parsed.data);
  }
  return SEVERITY_ORDER.filter((severity) => wanted.has(severity));
}

export function parseStateFilter(param: string | null): StateFilter {
  return param === 'fixed' || param === 'all' ? param : 'open';
}

export function parseFindingSort(param: string | null): FindingSort {
  return param === 'severity-asc' || param === 'location' || param === 'rule' ? param : 'severity';
}

export function parsePage(param: string | null): number {
  const page = Number.parseInt(param ?? '', 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

// ---- filtering ----

/** Does the text appear in the rule ID, the location or the message? Ignores case. */
export function matchesQuery(finding: Finding, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [finding.ruleId, finding.location, finding.message].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

export function matchesState(finding: Finding, state: StateFilter): boolean {
  return state === 'all' || finding.state === (state === 'open' ? 'OPEN' : 'FIXED');
}

export function filterFindings(items: Finding[], filters: FindingFilters): Finding[] {
  return items.filter(
    (finding) =>
      matchesState(finding, filters.state) &&
      matchesQuery(finding, filters.query) &&
      (filters.severities.length === 0 || filters.severities.includes(finding.severity)),
  );
}

export function countBySeverity(items: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const finding of items) counts[finding.severity] += 1;
  return counts;
}

// ---- sorting ----

function byText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

/** Sorted copy. Ties are broken the same way every time, so the table doesn't shuffle. */
export function sortFindings(items: Finding[], sort: FindingSort): Finding[] {
  const bySeverity = (a: Finding, b: Finding) => RANK[a.severity] - RANK[b.severity];
  const byLocation = (a: Finding, b: Finding) => byText(a.location, b.location);
  const byRule = (a: Finding, b: Finding) => byText(a.ruleId, b.ruleId);
  const tieBreak = (a: Finding, b: Finding) => byText(a.fingerprint, b.fingerprint);

  const compare: Record<FindingSort, (a: Finding, b: Finding) => number> = {
    severity: (a, b) => bySeverity(a, b) || byLocation(a, b) || byRule(a, b) || tieBreak(a, b),
    'severity-asc': (a, b) =>
      -bySeverity(a, b) || byLocation(a, b) || byRule(a, b) || tieBreak(a, b),
    location: (a, b) => byLocation(a, b) || bySeverity(a, b) || byRule(a, b) || tieBreak(a, b),
    rule: (a, b) => byRule(a, b) || bySeverity(a, b) || byLocation(a, b) || tieBreak(a, b),
  };
  return [...items].sort(compare[sort]);
}

// ---- paging ----

export type PageOf<T> = {
  items: T[];
  /** The page actually shown: a page number that is too big becomes the last page. */
  page: number;
  pages: number;
  total: number;
  /** 1-based position of the first and last item shown, or 0 when empty. */
  from: number;
  to: number;
};

export function paginate<T>(
  items: T[],
  requestedPage: number,
  size = FINDINGS_PAGE_SIZE,
): PageOf<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, requestedPage), pages);
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}
