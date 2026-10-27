import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '@/lib/api/client';
import { createEndpoints } from '@/lib/api/endpoints';

const scan = {
  jobId: 'job-1',
  projectId: 'demo-app',
  scanType: 'SAST',
  targetId: null,
  status: 'QUEUED',
  requestedBy: 'demo',
  imageTag: null,
  createdAt: '2026-01-01T10:00:00Z',
  queuedAt: '2026-01-01T10:00:03Z',
  startedAt: null,
  finishedAt: null,
  summary: null,
  error: null,
};

function setup(responseBody: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 }));
  const client = createApiClient({
    baseUrl: 'https://api.example.com',
    getToken: () => 'tok',
    onUnauthorized: () => {},
    fetchImpl: fetchMock,
  });
  const lastCall = () => fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { api: createEndpoints(client), lastCall };
}

describe('endpoints', () => {
  it('login posts the credentials without an Authorization header', async () => {
    const { api, lastCall } = setup({
      token: 'a.b.c',
      expiresIn: 3600,
      user: { username: 'demo', role: 'user' },
    });

    const result = await api.login({ username: 'demo', password: 'demo123' });

    const [url, init] = lastCall();
    expect(result.user.username).toBe('demo');
    expect(url).toBe('https://api.example.com/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"username":"demo","password":"demo123"}');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('getTargets calls GET /targets', async () => {
    const { api, lastCall } = setup({ targets: [] });
    await api.getTargets();
    expect(lastCall()[0]).toBe('https://api.example.com/targets');
  });

  it('createScan returns upload instructions for SAST', async () => {
    const upload = {
      url: 'https://s3.example.com/k?sig=1',
      method: 'PUT',
      headers: {},
      expiresIn: 900,
    };
    const { api, lastCall } = setup({ jobId: 'j1', status: 'CREATED', upload });

    const result = await api.createScan({ projectId: 'demo-app', scanType: 'SAST' });

    expect(result.upload?.expiresIn).toBe(900);
    expect(lastCall()[0]).toBe('https://api.example.com/scans');
  });

  it('createScan fails if a SAST response has no upload instructions', async () => {
    const { api } = setup({ jobId: 'j1', status: 'CREATED' });

    const error = await api
      .createScan({ projectId: 'demo-app', scanType: 'SAST' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'invalid_response' });
  });

  it('createScan accepts a DAST response without upload instructions', async () => {
    const { api } = setup({ jobId: 'j1', status: 'CREATED' });
    const result = await api.createScan({
      projectId: 'demo-app',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    expect(result.jobId).toBe('j1');
  });

  it('startScan, getScan and getProjectScans use the right paths and encode IDs', async () => {
    const start = setup({ jobId: 'a/b', status: 'QUEUED' });
    await start.api.startScan('a/b');
    expect(start.lastCall()[0]).toBe('https://api.example.com/scans/a%2Fb/start');
    expect(start.lastCall()[1].method).toBe('POST');

    const get = setup(scan);
    await get.api.getScan('job-1');
    expect(get.lastCall()[0]).toBe('https://api.example.com/scans/job-1');

    const list = setup({ items: [scan], nextCursor: null });
    await list.api.getProjectScans('demo-app', { limit: 20, cursor: 'abc def' });
    expect(list.lastCall()[0]).toBe(
      'https://api.example.com/projects/demo-app/scans?limit=20&cursor=abc+def',
    );
  });

  it('getFindings sends the scan type as a query parameter', async () => {
    const { api, lastCall } = setup({ items: [] });
    await api.getFindings('demo-app', 'DAST');
    expect(lastCall()[0]).toBe('https://api.example.com/projects/demo-app/findings?scanType=DAST');
  });
});
