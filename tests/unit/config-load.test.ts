import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigError, loadConfig } from '@/lib/config';

const validBody = {
  apiBaseUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/',
  environment: 'rushikesh-lab',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function failure(promise: Promise<unknown>): Promise<ConfigError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ConfigError);
  return error as ConfigError;
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('loadConfig', () => {
  it('reads /config.json from the site root, never from a cache', async () => {
    const fetchMock = vi.fn(async () => json(validBody));
    vi.stubGlobal('fetch', fetchMock);

    const config = await loadConfig();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/config.json');
    expect(init.cache).toBe('no-store');
    expect(config).toEqual({
      apiBaseUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com',
      environment: 'rushikesh-lab',
    });
  });

  it('says the file is missing on a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    );
    const error = await failure(loadConfig());
    expect(error.message).toBe('config.json was not found on this site.');
  });

  it('says what the server answered for other errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 503 })),
    );
    const error = await failure(loadConfig());
    expect(error.message).toBe('The server answered 503 when loading config.json.');
  });

  it('says the file is not JSON when it is something else, like an HTML error page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Not Found</html>', { status: 200 })),
    );
    const error = await failure(loadConfig());
    expect(error.message).toBe('config.json is not valid JSON.');
  });

  it('lists what is wrong with the contents, in plain words', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ apiBaseUrl: 'nope' })),
    );
    const error = await failure(loadConfig());
    expect(error.message).toBe('config.json has the wrong contents.');
    expect(error.details).toEqual([
      '"apiBaseUrl" must be a full URL starting with http:// or https://',
      '"environment" is missing',
    ]);
  });

  it('says it could not reach the server when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const error = await failure(loadConfig());
    expect(error.message).toBe('Could not reach the server to load config.json.');
    expect(error.details).toEqual(['Check your internet connection and try again.']);
  });

  it('gives up after 10 seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    const pending = failure(loadConfig());

    await vi.advanceTimersByTimeAsync(10_000);

    expect((await pending).message).toBe('Loading config.json took too long.');
  });

  it('lets a cancel from the caller through, as an AbortError and not a config error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    const controller = new AbortController();
    const pending = loadConfig(controller.signal).catch((e: unknown) => e);

    controller.abort();

    const error = await pending;
    expect(error).not.toBeInstanceOf(ConfigError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });
});
