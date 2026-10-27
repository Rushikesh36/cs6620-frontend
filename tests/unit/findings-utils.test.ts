import { describe, expect, it } from 'vitest';
import type { Finding } from '@/lib/api/schemas';
import {
  countBySeverity,
  filterFindings,
  FINDINGS_PAGE_SIZE,
  paginate,
  parseFindingSort,
  parsePage,
  parseSeverities,
  parseStateFilter,
  sortFindings,
} from '@/lib/utils/findings';

let n = 0;
const finding = (overrides: Partial<Finding>): Finding => ({
  fingerprint: `fp-${String(++n).padStart(4, '0')}`,
  ruleId: 'rule.generic',
  severity: 'LOW',
  location: 'app/a.py:1',
  message: 'A message.',
  state: 'OPEN',
  firstSeenJobId: 'job-1',
  lastSeenJobId: 'job-2',
  ...overrides,
});

const items = [
  finding({
    ruleId: 'python.eval',
    severity: 'HIGH',
    location: 'app/views.py:42',
    message: 'Avoid eval()',
    state: 'OPEN',
  }),
  finding({
    ruleId: 'python.md5',
    severity: 'MEDIUM',
    location: 'auth/tokens.py:23',
    message: 'MD5 is weak',
    state: 'OPEN',
  }),
  finding({
    ruleId: 'python.pickle',
    severity: 'HIGH',
    location: 'services/cache.py:56',
    message: 'Pickle can run code',
    state: 'FIXED',
  }),
  finding({
    ruleId: 'python.encoding',
    severity: 'INFO',
    location: 'utils/io.py:12',
    message: 'Set an encoding',
    state: 'OPEN',
  }),
  finding({
    ruleId: 'zap.csp',
    severity: 'LOW',
    location: 'GET /',
    message: 'No Content-Security-Policy',
    state: 'FIXED',
  }),
];
const rules = (list: Finding[]) => list.map((f) => f.ruleId);
const none = { severities: [], state: 'all' as const, query: '' };

describe('reading the address bar', () => {
  it('parses severities, ignoring unknown ones and keeping a fixed order', () => {
    expect(parseSeverities('low,HIGH')).toEqual(['HIGH', 'LOW']);
    expect(parseSeverities('HIGH,HIGH, medium ,CRITICAL,')).toEqual(['HIGH', 'MEDIUM']);
    expect(parseSeverities('')).toEqual([]);
    expect(parseSeverities(null)).toEqual([]);
  });

  it('falls back to the default for unknown state, sort and page values', () => {
    expect(parseStateFilter('fixed')).toBe('fixed');
    expect(parseStateFilter('all')).toBe('all');
    expect(parseStateFilter('open')).toBe('open');
    expect(parseStateFilter('banana')).toBe('open');
    expect(parseStateFilter(null)).toBe('open');

    expect(parseFindingSort('location')).toBe('location');
    expect(parseFindingSort('rule')).toBe('rule');
    expect(parseFindingSort('severity-asc')).toBe('severity-asc');
    expect(parseFindingSort('nope')).toBe('severity');

    expect(parsePage('3')).toBe(3);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-4')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage(null)).toBe(1);
  });
});

describe('filterFindings', () => {
  it('state: Open, Fixed or All', () => {
    expect(rules(filterFindings(items, { ...none, state: 'open' }))).toEqual([
      'python.eval',
      'python.md5',
      'python.encoding',
    ]);
    expect(rules(filterFindings(items, { ...none, state: 'fixed' }))).toEqual([
      'python.pickle',
      'zap.csp',
    ]);
    expect(filterFindings(items, none)).toHaveLength(5);
  });

  it('severity: any number of them at once', () => {
    expect(rules(filterFindings(items, { ...none, severities: ['HIGH'] }))).toEqual([
      'python.eval',
      'python.pickle',
    ]);
    expect(rules(filterFindings(items, { ...none, severities: ['MEDIUM', 'INFO'] }))).toEqual([
      'python.md5',
      'python.encoding',
    ]);
  });

  it('search: matches the rule ID, the location and the message, ignoring case', () => {
    expect(rules(filterFindings(items, { ...none, query: 'EVAL' }))).toEqual(['python.eval']); // rule ID and message
    expect(rules(filterFindings(items, { ...none, query: 'tokens.py' }))).toEqual(['python.md5']); // location
    expect(rules(filterFindings(items, { ...none, query: 'content-security' }))).toEqual([
      'zap.csp',
    ]); // message
    expect(filterFindings(items, { ...none, query: 'nothing like this' })).toEqual([]);
  });

  it('search ignores spaces around the text, and treats an empty search as "everything"', () => {
    expect(rules(filterFindings(items, { ...none, query: '  md5  ' }))).toEqual(['python.md5']);
    expect(filterFindings(items, { ...none, query: '   ' })).toHaveLength(5);
  });

  it('search treats characters like * and ( as plain text, not as a pattern', () => {
    expect(filterFindings(items, { ...none, query: '.*' })).toEqual([]);
    expect(rules(filterFindings(items, { ...none, query: 'eval()' }))).toEqual(['python.eval']);
  });

  it('combines state, severity and search', () => {
    expect(
      rules(filterFindings(items, { severities: ['HIGH'], state: 'open', query: 'py' })),
    ).toEqual(['python.eval']);
  });
});

describe('countBySeverity', () => {
  it('counts each severity, with zeros for the ones that are missing', () => {
    expect(countBySeverity(items)).toEqual({ HIGH: 2, MEDIUM: 1, LOW: 1, INFO: 1 });
    expect(countBySeverity([])).toEqual({ HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 });
  });
});

describe('sortFindings', () => {
  it('default: HIGH first, then by location', () => {
    expect(rules(sortFindings(items, 'severity'))).toEqual([
      'python.eval', // HIGH, app/views.py
      'python.pickle', // HIGH, services/cache.py
      'python.md5',
      'zap.csp',
      'python.encoding',
    ]);
  });

  it('other orders: lowest severity first, by location, by rule', () => {
    expect(rules(sortFindings(items, 'severity-asc'))[0]).toBe('python.encoding');
    // Alphabetical, ignoring capitals: app/, auth/, GET /, services/, utils/
    expect(rules(sortFindings(items, 'location'))).toEqual([
      'python.eval',
      'python.md5',
      'zap.csp',
      'python.pickle',
      'python.encoding',
    ]);
    expect(rules(sortFindings(items, 'rule'))).toEqual([
      'python.encoding',
      'python.eval',
      'python.md5',
      'python.pickle',
      'zap.csp',
    ]);
  });

  it('puts "file.py:2" before "file.py:10", like a person would', () => {
    const lines = [finding({ location: 'a.py:10' }), finding({ location: 'a.py:2' })];
    expect(sortFindings(lines, 'location').map((f) => f.location)).toEqual(['a.py:2', 'a.py:10']);
  });

  it('gives the same order every time, even for equal findings, and leaves the input alone', () => {
    const twins = [finding({ fingerprint: 'b' }), finding({ fingerprint: 'a' })];
    expect(sortFindings(twins, 'severity').map((f) => f.fingerprint)).toEqual(['a', 'b']);
    expect(twins.map((f) => f.fingerprint)).toEqual(['b', 'a']);
  });
});

describe('paginate', () => {
  const list = Array.from({ length: 120 }, (_, i) => i + 1);

  it('shows 50 at a time, and says which ones', () => {
    expect(FINDINGS_PAGE_SIZE).toBe(50);
    const first = paginate(list, 1);
    expect(first).toMatchObject({ page: 1, pages: 3, total: 120, from: 1, to: 50 });
    expect(first.items).toHaveLength(50);

    const last = paginate(list, 3);
    expect(last).toMatchObject({ page: 3, from: 101, to: 120 });
    expect(last.items).toEqual(list.slice(100));
  });

  it('keeps a page number that is too big or too small inside the range', () => {
    expect(paginate(list, 99).page).toBe(3);
    expect(paginate(list, 0).page).toBe(1);
    expect(paginate(list, -5).page).toBe(1);
  });

  it('handles an exact multiple, a single item and nothing at all', () => {
    expect(
      paginate(
        Array.from({ length: 100 }, (_, i) => i),
        2,
      ),
    ).toMatchObject({ pages: 2, from: 51, to: 100 });
    expect(paginate([1], 1)).toMatchObject({ pages: 1, from: 1, to: 1 });
    expect(paginate([], 1)).toMatchObject({ pages: 1, total: 0, from: 0, to: 0, items: [] });
  });
});
