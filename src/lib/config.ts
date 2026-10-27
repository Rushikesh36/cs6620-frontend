import { z } from 'zod';

// Terraform writes this file into the S3 bucket at deploy time, so the same build
// works in every AWS account. See public/config.example.json.
export const configSchema = z.object({
  apiBaseUrl: z
    .url({
      protocol: /^https?$/,
      message: 'must be a full URL starting with http:// or https://',
    })
    // Endpoint paths are appended with a leading slash, so drop any trailing one.
    .transform((url) => url.replace(/\/+$/, '')),
  environment: z.string().trim().min(1, 'must not be empty'),
});

export type AppConfig = z.infer<typeof configSchema>;

export const CONFIG_URL = '/config.json';
const CONFIG_TIMEOUT_MS = 10_000;

/** Thrown when config.json can't be loaded or is invalid. `details` are plain-language bullets. */
export class ConfigError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'ConfigError';
    this.details = details;
  }
}

export function parseConfig(raw: unknown): AppConfig {
  const result = configSchema.safeParse(raw);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => {
    const field = issue.path.join('.');
    if (!field) return 'The file must contain a JSON object.';
    // A missing field has no useful message of its own.
    return issue.code === 'invalid_type' && issue.input === undefined
      ? `"${field}" is missing`
      : `"${field}" ${issue.message}`;
  });
  throw new ConfigError('config.json has the wrong contents.', details);
}

export async function loadConfig(signal?: AbortSignal): Promise<AppConfig> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), CONFIG_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;

  let response: Response;
  try {
    // no-store: the file is replaced by Terraform, so never trust a cached copy.
    response = await fetch(CONFIG_URL, { cache: 'no-store', signal: combined });
  } catch {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new ConfigError(
      timeout.signal.aborted
        ? 'Loading config.json took too long.'
        : 'Could not reach the server to load config.json.',
      ['Check your internet connection and try again.'],
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ConfigError(
      response.status === 404
        ? 'config.json was not found on this site.'
        : `The server answered ${response.status} when loading config.json.`,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new ConfigError('config.json is not valid JSON.');
  }
  return parseConfig(raw);
}
