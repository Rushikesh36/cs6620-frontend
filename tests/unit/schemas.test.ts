import { describe, expect, it } from 'vitest';
import {
  apiErrorBodySchema,
  createScanRequestSchema,
  createScanResponseSchema,
  findingsResponseSchema,
  isFinalStatus,
  loginResponseSchema,
  scanListResponseSchema,
  scanSchema,
  startScanResponseSchema,
  targetsResponseSchema,
} from '@/lib/api/schemas';

const completedScan = {
  jobId: 'job-1',
  projectId: 'demo-app',
  scanType: 'SAST',
  targetId: null,
  status: 'COMPLETED',
  requestedBy: 'demo',
  imageTag: 'semgrep-1.4.0-abc1234',
  createdAt: '2026-01-01T10:00:00Z',
  queuedAt: '2026-01-01T10:00:03Z',
  startedAt: '2026-01-01T10:00:08Z',
  finishedAt: '2026-01-01T10:00:28Z',
  summary: { new: 3, newHigh: 1, stillOpen: 5, fixed: 2 },
  error: null,
};

const finding = {
  fingerprint: 'a'.repeat(64),
  ruleId: 'python.lang.security.audit.eval',
  severity: 'HIGH',
  location: 'app/views.py:42',
  message: 'Avoid eval().',
  state: 'OPEN',
  firstSeenJobId: 'job-1',
  lastSeenJobId: 'job-2',
};

describe('loginResponseSchema', () => {
  const valid = { token: 'a.b.c', expiresIn: 3600, user: { username: 'demo', role: 'user' } };

  it('accepts a valid response, including the ci role', () => {
    expect(loginResponseSchema.safeParse(valid).success).toBe(true);
    expect(
      loginResponseSchema.safeParse({ ...valid, user: { username: 'bot', role: 'ci' } }).success,
    ).toBe(true);
  });

  it('rejects an unknown role, an empty token and a non-positive expiry', () => {
    expect(
      loginResponseSchema.safeParse({ ...valid, user: { username: 'x', role: 'admin' } }).success,
    ).toBe(false);
    expect(loginResponseSchema.safeParse({ ...valid, token: '' }).success).toBe(false);
    expect(loginResponseSchema.safeParse({ ...valid, expiresIn: 0 }).success).toBe(false);
  });
});

describe('targetsResponseSchema', () => {
  it('accepts a list, including an empty one', () => {
    const target = { targetId: 'juice-shop', name: 'OWASP Juice Shop', description: 'Test app' };
    expect(targetsResponseSchema.safeParse({ targets: [target] }).success).toBe(true);
    expect(targetsResponseSchema.safeParse({ targets: [] }).success).toBe(true);
  });

  it('rejects a target without an id', () => {
    expect(
      targetsResponseSchema.safeParse({ targets: [{ name: 'x', description: 'y' }] }).success,
    ).toBe(false);
  });
});

describe('createScanRequestSchema', () => {
  it('accepts SAST without a target and DAST with one', () => {
    expect(createScanRequestSchema.safeParse({ projectId: 'p', scanType: 'SAST' }).success).toBe(
      true,
    );
    expect(
      createScanRequestSchema.safeParse({
        projectId: 'p',
        scanType: 'DAST',
        targetId: 'juice-shop',
      }).success,
    ).toBe(true);
  });

  it('rejects DAST without a target and unknown scan types', () => {
    expect(createScanRequestSchema.safeParse({ projectId: 'p', scanType: 'DAST' }).success).toBe(
      false,
    );
    expect(createScanRequestSchema.safeParse({ projectId: 'p', scanType: 'IAST' }).success).toBe(
      false,
    );
  });
});

describe('createScanResponseSchema', () => {
  const upload = {
    url: 'https://bucket.s3.amazonaws.com/key?sig=1',
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip' },
    expiresIn: 900,
  };

  it('accepts a SAST response with upload info and a DAST response without', () => {
    expect(
      createScanResponseSchema.safeParse({ jobId: 'j', status: 'CREATED', upload }).success,
    ).toBe(true);
    expect(createScanResponseSchema.safeParse({ jobId: 'j', status: 'CREATED' }).success).toBe(
      true,
    );
  });

  it('rejects wrong status, a non-PUT upload and a malformed upload URL', () => {
    expect(createScanResponseSchema.safeParse({ jobId: 'j', status: 'QUEUED' }).success).toBe(
      false,
    );
    expect(
      createScanResponseSchema.safeParse({
        jobId: 'j',
        status: 'CREATED',
        upload: { ...upload, method: 'POST' },
      }).success,
    ).toBe(false);
    expect(
      createScanResponseSchema.safeParse({
        jobId: 'j',
        status: 'CREATED',
        upload: { ...upload, url: 'nope' },
      }).success,
    ).toBe(false);
  });
});

describe('startScanResponseSchema', () => {
  it('accepts QUEUED only', () => {
    expect(startScanResponseSchema.safeParse({ jobId: 'j', status: 'QUEUED' }).success).toBe(true);
    expect(startScanResponseSchema.safeParse({ jobId: 'j', status: 'RUNNING' }).success).toBe(
      false,
    );
  });
});

describe('scanSchema', () => {
  it('accepts a completed scan', () => {
    expect(scanSchema.safeParse(completedScan).success).toBe(true);
  });

  it('accepts an unfinished scan with null timestamps, summary and error', () => {
    const queued = {
      ...completedScan,
      status: 'QUEUED',
      startedAt: null,
      finishedAt: null,
      summary: null,
    };
    expect(scanSchema.safeParse(queued).success).toBe(true);
  });

  it('accepts a failed scan with an error message and a DAST target', () => {
    const failed = {
      ...completedScan,
      scanType: 'DAST',
      targetId: 'juice-shop',
      status: 'FAILED',
      summary: null,
      error: 'Scanner exited with code 1',
    };
    expect(scanSchema.safeParse(failed).success).toBe(true);
  });

  it('accepts a missing or null imageTag', () => {
    expect(scanSchema.safeParse({ ...completedScan, imageTag: undefined }).success).toBe(true);
    expect(scanSchema.safeParse({ ...completedScan, imageTag: null }).success).toBe(true);
  });

  it('rejects an unknown status, a bad date and a negative count', () => {
    expect(scanSchema.safeParse({ ...completedScan, status: 'PAUSED' }).success).toBe(false);
    expect(scanSchema.safeParse({ ...completedScan, createdAt: 'yesterday' }).success).toBe(false);
    expect(
      scanSchema.safeParse({
        ...completedScan,
        summary: { new: -1, newHigh: 0, stillOpen: 0, fixed: 0 },
      }).success,
    ).toBe(false);
  });

  it('rejects a missing required field and ignores unknown extra fields', () => {
    expect(scanSchema.safeParse({ ...completedScan, projectId: undefined }).success).toBe(false);

    const parsed = scanSchema.parse({ ...completedScan, somethingNew: 1 });
    expect(parsed).not.toHaveProperty('somethingNew');
  });
});

describe('scanListResponseSchema', () => {
  it('accepts items with and without a next cursor', () => {
    expect(
      scanListResponseSchema.safeParse({ items: [completedScan], nextCursor: 'abc' }).success,
    ).toBe(true);
    expect(scanListResponseSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it('rejects a missing nextCursor and an invalid item', () => {
    expect(scanListResponseSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      scanListResponseSchema.safeParse({ items: [{ jobId: 'x' }], nextCursor: null }).success,
    ).toBe(false);
  });
});

describe('findingsResponseSchema', () => {
  it('accepts valid findings', () => {
    expect(
      findingsResponseSchema.safeParse({
        items: [finding, { ...finding, severity: 'INFO', state: 'FIXED' }],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown severity or state and an empty fingerprint', () => {
    expect(
      findingsResponseSchema.safeParse({ items: [{ ...finding, severity: 'CRITICAL' }] }).success,
    ).toBe(false);
    expect(
      findingsResponseSchema.safeParse({ items: [{ ...finding, state: 'NEW' }] }).success,
    ).toBe(false);
    expect(
      findingsResponseSchema.safeParse({ items: [{ ...finding, fingerprint: '' }] }).success,
    ).toBe(false);
  });
});

describe('apiErrorBodySchema', () => {
  it('accepts { error } and rejects other shapes', () => {
    expect(apiErrorBodySchema.safeParse({ error: 'Nope' }).success).toBe(true);
    expect(apiErrorBodySchema.safeParse({ message: 'Nope' }).success).toBe(false);
  });
});

describe('isFinalStatus', () => {
  it('is true only for COMPLETED and FAILED', () => {
    expect(isFinalStatus('COMPLETED')).toBe(true);
    expect(isFinalStatus('FAILED')).toBe(true);
    expect(isFinalStatus('CREATED')).toBe(false);
    expect(isFinalStatus('QUEUED')).toBe(false);
    expect(isFinalStatus('RUNNING')).toBe(false);
  });
});
