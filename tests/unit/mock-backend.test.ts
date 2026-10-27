// @vitest-environment node
// Node (not jsdom) so the real fetch and AbortSignal work with MSW's Node server.
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '@/lib/api/client';
import { createEndpoints } from '@/lib/api/endpoints';
import { MockBackend, MOCK_UPLOAD_ORIGIN } from '@/mocks/backend';
import { createHandlers } from '@/mocks/handlers';
import type { MockOptions } from '@/mocks/options';

const BASE = 'https://api.test';
let clock = Date.parse('2026-03-01T12:00:00Z');
let token: string | null = null;
let unauthorized = vi.fn();

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

function useBackend(options: Partial<MockOptions> = {}) {
  const backend = new MockBackend({ now: () => clock, random: () => 0.99, ...options });
  server.use(...createHandlers(BASE, backend));
  return backend;
}

const client = createApiClient({
  baseUrl: BASE,
  getToken: () => token,
  onUnauthorized: () => unauthorized(),
});
const api = createEndpoints(client);

async function loginAs(username = 'demo', password = 'demo123') {
  const result = await api.login({ username, password });
  token = result.token;
  return result;
}

const advance = (ms: number) => {
  clock += ms;
};

async function uploadTo(
  upload: { url: string; headers: Record<string, string> },
  extra: HeadersInit = {},
) {
  return fetch(upload.url, {
    method: 'PUT',
    headers: { ...upload.headers, ...extra },
    body: new Blob(['zip']),
  });
}

async function runSastToCompletion(projectId: string) {
  const created = await api.createScan({ projectId, scanType: 'SAST' });
  const upload = created.upload;
  if (!upload) throw new Error('expected upload info');
  expect((await uploadTo(upload)).status).toBe(200);
  await api.startScan(created.jobId);
  advance(21_000);
  return api.getScan(created.jobId);
}

beforeEach(() => {
  clock = Date.parse('2026-03-01T12:00:00Z');
  token = null;
  unauthorized = vi.fn();
});

describe('mock login and tokens', () => {
  it('logs in demo (user) and ci-bot (ci), and rejects anything else with 401', async () => {
    useBackend();
    expect((await loginAs()).user).toEqual({ username: 'demo', role: 'user' });
    expect((await loginAs('ci-bot', 'ci-bot123')).user.role).toBe('ci');

    const error = await api.login({ username: 'demo', password: 'nope' }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 401, message: 'Wrong username or password.' });
  });

  it('issues a JWT-shaped token that lives tokenMinutes', async () => {
    useBackend({ tokenMinutes: 2 });
    const { token: jwt, expiresIn } = await loginAs();
    const payload = JSON.parse(atob(jwt.split('.')[1] ?? '')) as { exp: number; iat: number };
    expect(expiresIn).toBe(120);
    expect(payload.exp - payload.iat).toBe(120);
  });

  it('answers 401 without a token, and after the token has expired', async () => {
    useBackend({ tokenMinutes: 2 });
    const noToken = await api.getTargets().catch((e: unknown) => e);
    expect(noToken).toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledTimes(1);

    await loginAs();
    await expect(api.getTargets()).resolves.toBeTruthy();
    advance(121_000);
    await expect(api.getTargets()).rejects.toMatchObject({ status: 401 });
  });
});

describe('mock targets', () => {
  it('lists Juice Shop, or nothing when noTargets is on', async () => {
    useBackend();
    await loginAs();
    expect((await api.getTargets()).targets.map((t) => t.targetId)).toEqual(['juice-shop']);

    useBackend({ noTargets: true });
    expect((await api.getTargets()).targets).toEqual([]);
  });
});

describe('mock SAST scan', () => {
  it('walks CREATED > QUEUED > RUNNING > COMPLETED and produces findings', async () => {
    useBackend();
    await loginAs();
    const created = await api.createScan({ projectId: 'my-app', scanType: 'SAST' });
    expect(created.upload?.expiresIn).toBe(900);
    expect(created.upload?.url.startsWith(MOCK_UPLOAD_ORIGIN)).toBe(true);

    expect((await api.getScan(created.jobId)).status).toBe('CREATED');

    expect((await uploadTo(created.upload!)).status).toBe(200);
    expect(await api.startScan(created.jobId)).toEqual({ jobId: created.jobId, status: 'QUEUED' });
    expect((await api.getScan(created.jobId)).status).toBe('QUEUED');

    advance(6_000);
    const running = await api.getScan(created.jobId);
    expect(running.status).toBe('RUNNING');
    expect(running.imageTag).toBe('semgrep-1.4.0-abc1234');
    expect(running.summary).toBeNull();

    advance(15_000);
    const done = await api.getScan(created.jobId);
    expect(done.status).toBe('COMPLETED');
    expect(done.summary).toMatchObject({ new: 9, stillOpen: 0, fixed: 0 });
    expect(done.summary?.newHigh).toBeGreaterThan(0);

    const { items } = await api.getFindings('my-app', 'SAST');
    expect(items).toHaveLength(9);
    expect(items.every((f) => f.state === 'OPEN' && f.firstSeenJobId === created.jobId)).toBe(true);
    expect(new Set(items.map((f) => f.fingerprint)).size).toBe(9);
    expect(items[0]?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses /start before the upload, and a second /start', async () => {
    useBackend();
    await loginAs();
    const created = await api.createScan({ projectId: 'my-app', scanType: 'SAST' });
    await expect(api.startScan(created.jobId)).rejects.toMatchObject({ status: 400 });

    await uploadTo(created.upload!);
    await api.startScan(created.jobId);
    await expect(api.startScan(created.jobId)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects an upload that sends an Authorization header, like a signed S3 URL would', async () => {
    useBackend();
    await loginAs();
    const created = await api.createScan({ projectId: 'my-app', scanType: 'SAST' });
    expect((await uploadTo(created.upload!, { Authorization: 'Bearer x' })).status).toBe(403);
  });

  it('rejects an upload after the URL has expired', async () => {
    useBackend();
    await loginAs();
    const created = await api.createScan({ projectId: 'my-app', scanType: 'SAST' });
    advance(901_000);
    expect((await uploadTo(created.upload!)).status).toBe(403);
  });
});

describe('mock DAST scan', () => {
  it('runs a scan on Juice Shop with no upload step', async () => {
    useBackend();
    await loginAs();
    const created = await api.createScan({
      projectId: 'my-app',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    expect(created.upload).toBeUndefined();
    await api.startScan(created.jobId);
    advance(21_000);
    const done = await api.getScan(created.jobId);
    expect(done).toMatchObject({ status: 'COMPLETED', targetId: 'juice-shop' });
    expect(done.summary?.new).toBe(8);
    expect(
      (await api.getFindings('my-app', 'DAST')).items.every(
        (f) => f.location.startsWith('GET ') || f.location.startsWith('POST '),
      ),
    ).toBe(true);
  });

  it('rejects an unknown target and a bad project ID with a 400 and a message', async () => {
    useBackend();
    await loginAs();
    await expect(
      api.createScan({ projectId: 'my-app', scanType: 'DAST', targetId: 'http://evil.example' }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Unknown target') });
    await expect(api.createScan({ projectId: 'Bad_ID', scanType: 'SAST' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('projectId must be'),
    });
  });
});

describe('mock special cases', () => {
  it('keeps stuck-demo RUNNING forever', async () => {
    useBackend({ tokenMinutes: 600 }); // long token: the test jumps an hour ahead
    await loginAs();
    const created = await api.createScan({
      projectId: 'stuck-demo',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    await api.startScan(created.jobId);
    advance(3_600_000);
    expect((await api.getScan(created.jobId)).status).toBe('RUNNING');
  });

  it('always fails fail-demo with a realistic error', async () => {
    useBackend();
    await loginAs();
    const created = await api.createScan({
      projectId: 'fail-demo',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    await api.startScan(created.jobId);
    advance(21_000);
    const scan = await api.getScan(created.jobId);
    expect(scan.status).toBe('FAILED');
    expect(scan.summary).toBeNull();
    expect(scan.error).toBeTruthy();
    expect(scan.finishedAt).toBeTruthy();
  });

  it('fails about 1 in 5 jobs when failureRate is 0.2, and none when it is 0', async () => {
    let n = 0;
    useBackend({
      failureRate: 0.2,
      random: () => [0.1, 0.5, 0.9, 0.7, 0.3, 0.6, 0.8, 0.95, 0.4, 0.55][n++ % 10] ?? 0.5,
    });
    await loginAs();
    const statuses: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = await api.createScan({
        projectId: `proj-${i}`,
        scanType: 'DAST',
        targetId: 'juice-shop',
      });
      await api.startScan(c.jobId);
    }
    advance(21_000);
    for (const item of [...Array(10).keys()]) {
      const { items } = await api.getProjectScans(`proj-${item}`);
      statuses.push(items[0]?.status ?? '?');
    }
    expect(statuses.filter((s) => s === 'FAILED').length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s === 'COMPLETED').length).toBeGreaterThan(5);

    useBackend({ failureRate: 0 });
    const ok = await api.createScan({
      projectId: 'no-fail',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    await api.startScan(ok.jobId);
    advance(21_000);
    expect((await api.getScan(ok.jobId)).status).toBe('COMPLETED');
  });

  it('can fail before the scanner starts ("Could not start scanner task")', async () => {
    useBackend({ failureRate: 1, random: () => 0.99 });
    await loginAs();
    const c = await api.createScan({
      projectId: 'my-app',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    await api.startScan(c.jobId);
    advance(6_000);
    const scan = await api.getScan(c.jobId);
    expect(scan).toMatchObject({
      status: 'FAILED',
      error: 'Could not start scanner task',
      startedAt: null,
    });
  });

  it('answers random 500s when asked, but never on login', async () => {
    useBackend({ random500Rate: 1 });
    await expect(loginAs()).resolves.toBeTruthy();
    const error = await api.getTargets().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500 });
  });

  it('returns 404 for an unknown job', async () => {
    useBackend();
    await loginAs();
    await expect(api.getScan('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('mock findings across scans', () => {
  it('a second scan fixes some findings and adds new ones', async () => {
    useBackend();
    await loginAs();
    const first = await runSastToCompletion('repeat-app');
    const second = await runSastToCompletion('repeat-app');

    expect(first.summary).toMatchObject({ new: 9, fixed: 0, stillOpen: 0 });
    expect(second.summary?.fixed).toBe(2);
    expect(second.summary?.new).toBeGreaterThan(0);
    expect(second.summary?.stillOpen).toBe(7);

    const { items } = await api.getFindings('repeat-app', 'SAST');
    expect(items.filter((f) => f.state === 'FIXED')).toHaveLength(2);
    expect(items.filter((f) => f.firstSeenJobId === second.jobId).length).toBe(second.summary?.new);
    expect(items.filter((f) => f.state === 'OPEN' && f.lastSeenJobId === second.jobId).length).toBe(
      (second.summary?.new ?? 0) + (second.summary?.stillOpen ?? 0),
    );
  });

  it('keeps SAST and DAST findings separate, and unknown projects empty', async () => {
    useBackend();
    await loginAs();
    await runSastToCompletion('sast-only');
    expect((await api.getFindings('sast-only', 'DAST')).items).toEqual([]);
    expect((await api.getFindings('never-used', 'SAST')).items).toEqual([]);
  });
});

describe('mock scan history', () => {
  it('has seeded history for demo-app, newest first, with a mix of statuses', async () => {
    useBackend();
    await loginAs();
    const { items, nextCursor } = await api.getProjectScans('demo-app');
    expect(items).toHaveLength(4);
    expect(nextCursor).toBeNull();
    const times = items.map((s) => Date.parse(s.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(items.map((s) => s.status)).toContain('FAILED');
    expect(items.map((s) => s.scanType)).toContain('DAST');
    expect((await api.getFindings('demo-app', 'SAST')).items.length).toBeGreaterThan(9);
  });

  it('pages with an opaque cursor and rejects a made-up one', async () => {
    useBackend();
    await loginAs();
    const page1 = await api.getProjectScans('demo-app', { limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await api.getProjectScans('demo-app', { limit: 3, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    await expect(api.getProjectScans('demo-app', { cursor: 'garbage' })).rejects.toMatchObject({
      status: 400,
    });
  });
});
