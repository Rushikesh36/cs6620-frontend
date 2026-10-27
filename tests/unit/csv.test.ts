import { describe, expect, it } from 'vitest';
import type { Finding } from '@/lib/api/schemas';
import { buildCsv, escapeCsvField, findingsFilename, findingsToCsv } from '@/lib/utils/csv';

/** A small CSV reader, so the tests can check that what goes in comes back out unchanged. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += c;
  }
  return rows;
}

describe('escapeCsvField', () => {
  it('leaves ordinary text alone', () => {
    expect(escapeCsvField('app/views.py:42')).toBe('app/views.py:42');
    expect(escapeCsvField('')).toBe('');
    expect(escapeCsvField('plain words here')).toBe('plain words here');
    expect(escapeCsvField('café ☕')).toBe('café ☕');
  });

  it('wraps a field with a comma in quotes', () => {
    expect(escapeCsvField('one, two')).toBe('"one, two"');
  });

  it('doubles quotes, and wraps the field', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('"')).toBe('""""');
  });

  it.each([
    ['a line feed', 'line one\nline two'],
    ['a carriage return', 'line one\rline two'],
    ['both', 'line one\r\nline two'],
  ])('wraps a field with %s in quotes', (_label, value) => {
    expect(escapeCsvField(value)).toBe(`"${value}"`);
  });

  it('copes with commas, quotes and line breaks all at once', () => {
    expect(escapeCsvField('a, "b"\nc')).toBe('"a, ""b""\nc"');
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'defuses a value a spreadsheet would run as a formula: %j',
    (value) => {
      const escaped = escapeCsvField(value);
      expect(escaped.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('defuses a formula that also needs quoting', () => {
    expect(escapeCsvField('=HYPERLINK("http://evil.example","click"),x')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""click""),x"',
    );
  });

  it('only touches the start of a value, so a minus or equals sign inside is fine', () => {
    expect(escapeCsvField('GET /a?x=1')).toBe('GET /a?x=1');
    expect(escapeCsvField('rule-name')).toBe('rule-name');
    expect(escapeCsvField('a@b.example')).toBe('a@b.example');
  });
});

describe('buildCsv', () => {
  it('writes a header and rows separated by CRLF, ending with one', () => {
    expect(
      buildCsv(
        ['A', 'B'],
        [
          ['1', '2'],
          ['3', '4'],
        ],
      ),
    ).toBe('A,B\r\n1,2\r\n3,4\r\n');
  });

  it('writes just the header when there are no rows', () => {
    expect(buildCsv(['A', 'B'], [])).toBe('A,B\r\n');
  });

  it('reads back as the same table, whatever the text contains', () => {
    const rows = [
      ['plain', 'with, comma', 'with "quotes"', 'two\nlines', 'both, "q"\r\nand lines', ''],
      ['', 'x', '', '', '', 'y'],
    ];
    expect(parseCsv(buildCsv(['1', '2', '3', '4', '5', '6'], rows)).slice(1)).toEqual(rows);
  });
});

describe('findingsToCsv', () => {
  const finding: Finding = {
    fingerprint: 'a'.repeat(64),
    ruleId: 'python.lang.security.audit.eval-detected',
    severity: 'HIGH',
    location: 'GET /rest/products/search?q',
    message: 'Input "q" reaches the query, unescaped.\nSee the report.',
    state: 'OPEN',
    firstSeenJobId: 'job-1',
    lastSeenJobId: 'job-2',
  };

  it('has a header row and one row per finding, with every column', () => {
    const [header, row] = parseCsv(findingsToCsv([finding]));
    expect(header).toEqual([
      'Severity',
      'Rule ID',
      'Location',
      'Message',
      'State',
      'First seen (job ID)',
      'Last seen (job ID)',
      'Fingerprint',
    ]);
    expect(row).toEqual([
      'HIGH',
      'python.lang.security.audit.eval-detected',
      'GET /rest/products/search?q',
      'Input "q" reaches the query, unescaped.\nSee the report.',
      'OPEN',
      'job-1',
      'job-2',
      'a'.repeat(64),
    ]);
  });

  it('keeps the order it is given, and has only the header for no findings', () => {
    const second = { ...finding, fingerprint: 'b'.repeat(64), ruleId: 'second.rule' };
    expect(parseCsv(findingsToCsv([finding, second])).map((r) => r[1])).toEqual([
      'Rule ID',
      'python.lang.security.audit.eval-detected',
      'second.rule',
    ]);
    expect(parseCsv(findingsToCsv([]))).toHaveLength(1);
  });

  it('defuses a hostile message', () => {
    const [, row] = parseCsv(findingsToCsv([{ ...finding, message: "=cmd|' /C calc'!A0" }]));
    expect(row?.[3]?.startsWith("'")).toBe(true);
  });
});

describe('findingsFilename', () => {
  it('names the project, the scan type and the date', () => {
    expect(findingsFilename('demo-app', 'SAST', new Date(2026, 2, 1))).toBe(
      'findings-demo-app-sast-2026-03-01.csv',
    );
    expect(findingsFilename('web-shop', 'DAST', new Date(2026, 11, 31))).toBe(
      'findings-web-shop-dast-2026-12-31.csv',
    );
  });

  it('keeps unusual characters out of the file name', () => {
    expect(findingsFilename('a/b\\c:d', 'SAST', new Date(2026, 0, 5))).toBe(
      'findings-a-b-c-d-sast-2026-01-05.csv',
    );
  });
});
