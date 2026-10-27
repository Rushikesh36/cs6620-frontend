import { z } from 'zod';
import { devWarn } from '@/lib/utils/dev-log';
import { apiErrorBodySchema } from './schemas';

export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * - http: the server answered with an error status
 * - network: no answer (offline, DNS, CORS failure, ...)
 * - timeout: no answer within the time limit
 * - invalid_response: the server answered 2xx but not with what the contract promises
 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid_response';

export class ApiError extends Error {
  /** HTTP status, or 0 when there was no HTTP answer (network, timeout). */
  readonly status: number;
  readonly kind: ApiErrorKind;

  constructor(status: number, message: string, kind: ApiErrorKind = 'http') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Your session expired, please log in again.';
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return "We couldn't find that.";
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'The request could not be completed.';
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  /** Called when a protected endpoint answers 401: the owner should log the user out. */
  onUnauthorized: () => void;
  timeoutMs?: number;
  /** Injectable for tests. Defaults to the global fetch at call time. */
  fetchImpl?: typeof fetch;
};

export type QueryParams = Record<string, string | number | undefined | null>;

export type RequestOptions<T> = {
  method?: 'GET' | 'POST';
  /** Must start with "/". */
  path: string;
  query?: QueryParams;
  body?: unknown;
  /** Every response is validated against this. */
  schema: z.ZodType<T>;
  /** false for /login: no Authorization header, and a 401 is not a "session expired". */
  auth?: boolean;
  /** From TanStack Query, so cancelled queries cancel the request. */
  signal?: AbortSignal;
};

export type ApiClient = {
  request: <T>(options: RequestOptions<T>) => Promise<T>;
};

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${path}${search ? `?${search}` : ''}`;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, getToken, onUnauthorized, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  async function request<T>(req: RequestOptions<T>): Promise<T> {
    const { method = 'GET', path, query, body, schema, auth = true, signal } = req;
    const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;

    let response: Response;
    let text: string;
    try {
      response = await fetchImpl(buildUrl(baseUrl, path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combined,
      });
      // The timer also covers reading the body, so a stalled download can't hang forever.
      text = await response.text();
    } catch (error) {
      // A cancel from the caller is not an error to show: let it through untouched.
      if (signal?.aborted) throw error;
      if (timeout.signal.aborted) {
        throw new ApiError(0, 'The server took too long to answer. Please try again.', 'timeout');
      }
      throw new ApiError(
        0,
        'Could not reach the server. Check your internet connection and try again.',
        'network',
      );
    } finally {
      clearTimeout(timer);
    }

    const parsed = parseJson(text);

    if (!response.ok) {
      if (response.status === 401 && auth) onUnauthorized();
      const errorBody = parsed.ok ? apiErrorBodySchema.safeParse(parsed.value) : null;
      const serverMessage = errorBody?.success ? errorBody.data.error.trim() : '';
      throw new ApiError(response.status, serverMessage || defaultMessage(response.status));
    }

    const invalid = () =>
      new ApiError(
        response.status,
        "The server sent an answer we couldn't understand. Please try again.",
        'invalid_response',
      );

    if (!parsed.ok) {
      devWarn(`[api] ${method} ${path}: response was not valid JSON`);
      throw invalid();
    }
    const result = schema.safeParse(parsed.value);
    if (!result.success) {
      devWarn(`[api] ${method} ${path}: response did not match the contract`, result.error.issues);
      throw invalid();
    }
    return result.data;
  }

  return { request };
}
