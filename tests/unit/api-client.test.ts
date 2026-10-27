import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiClient } from '@/lib/api/client';

const okSchema = z.object({ hello: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

function setup(
  fetchImpl: typeof fetch,
  overrides: { token?: string | null; timeoutMs?: number } = {},
) {
  const onUnauthorized = vi.fn();
  const client = createApiClient({
    baseUrl: 'https://api.example.com',
    getToken: () => (overrides.token === undefined ? 'tok123' : overrides.token),
    onUnauthorized,
    timeoutMs: overrides.timeoutMs,
    fetchImpl,
  });
  return { client, onUnauthorized };
}

async function rejectionOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the request to fail');
}

beforeEach(() => {
  // Schema-mismatch warnings are expected in some tests; keep the output clean.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createApiClient', () => {
  it('prefixes the base URL, adds the Authorization header and returns validated data', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hello: 'world' }));
    const { client } = setup(fetchMock);

    const data = await client.request({ path: '/things', schema: okSchema });

    expect(data).toEqual({ hello: 'world' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/things');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
  });

  it('sends no Authorization header when auth is false', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hello: 'x' }));
    const { client } = setup(fetchMock);

    await client.request({ path: '/login', schema: okSchema, auth: false });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends no Authorization header when there is no token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hello: 'x' }));
    const { client } = setup(fetchMock, { token: null });

    await client.request({ path: '/x', schema: okSchema });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends a JSON body with a Content-Type, and skips undefined query values', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hello: 'x' }));
    const { client } = setup(fetchMock);

    await client.request({
      method: 'POST',
      path: '/scans',
      query: { limit: 20, cursor: undefined, scanType: 'SAST' },
      body: { a: 1 },
      schema: okSchema,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/scans?limit=20&scanType=SAST');
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('on 401 from a protected endpoint, calls onUnauthorized and throws an ApiError', async () => {
    const { client, onUnauthorized } = setup(async () =>
      jsonResponse({ error: 'Token expired' }, 401),
    );

    const error = await rejectionOf(client.request({ path: '/scans/1', schema: okSchema }));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(401);
    expect(error.kind).toBe('http');
    expect(error.message).toBe('Token expired');
  });

  it('on 401 from /login (auth: false), does not trigger logout', async () => {
    const { client, onUnauthorized } = setup(async () =>
      jsonResponse({ error: 'Bad credentials' }, 401),
    );

    const error = await rejectionOf(
      client.request({ path: '/login', schema: okSchema, auth: false }),
    );

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(error.status).toBe(401);
  });

  it('turns error responses into ApiError, using the server message when present', async () => {
    const { client } = setup(async () => jsonResponse({ error: 'projectId is invalid' }, 400));

    const error = await rejectionOf(client.request({ path: '/scans', schema: okSchema }));

    expect(error).toMatchObject({ status: 400, kind: 'http', message: 'projectId is invalid' });
  });

  it.each([
    [403, "You don't have permission to do this."],
    [404, "We couldn't find that."],
    [500, 'Something went wrong on our side. Please try again.'],
    [418, 'The request could not be completed.'],
  ])(
    'uses a friendly default message for status %i when the body has none',
    async (status, message) => {
      const { client } = setup(async () => jsonResponse('<html>Bad gateway</html>', status));

      const error = await rejectionOf(client.request({ path: '/x', schema: okSchema }));

      expect(error.status).toBe(status);
      expect(error.message).toBe(message);
    },
  );

  it('turns a failed fetch into a network ApiError with status 0', async () => {
    const { client } = setup(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await rejectionOf(client.request({ path: '/x', schema: okSchema }));

    expect(error).toMatchObject({ status: 0, kind: 'network' });
    expect(error.message).toMatch(/internet connection/);
  });

  it('times out when the server does not answer in time', async () => {
    vi.useFakeTimers();
    const hangingFetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      })) as unknown as typeof fetch;
    const { client } = setup(hangingFetch, { timeoutMs: 15_000 });

    const pending = rejectionOf(client.request({ path: '/slow', schema: okSchema }));
    await vi.advanceTimersByTimeAsync(15_000);
    const error = await pending;

    expect(error).toMatchObject({ status: 0, kind: 'timeout' });
  });

  it('does not wrap a cancel from the caller', async () => {
    const hangingFetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      })) as unknown as typeof fetch;
    const { client } = setup(hangingFetch);
    const controller = new AbortController();

    const pending = client.request({ path: '/x', schema: okSchema, signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a 200 response that does not match the schema', async () => {
    const { client } = setup(async () => jsonResponse({ hello: 42 }));

    const error = await rejectionOf(client.request({ path: '/x', schema: okSchema }));

    expect(error).toMatchObject({ status: 200, kind: 'invalid_response' });
  });

  it('rejects a 200 response that is not JSON', async () => {
    const { client } = setup(async () => jsonResponse('not json'));

    const error = await rejectionOf(client.request({ path: '/x', schema: okSchema }));

    expect(error.kind).toBe('invalid_response');
  });
});
