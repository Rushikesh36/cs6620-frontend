export type MockOptions = {
  /** How long a login token lives. Set NEXT_PUBLIC_MOCK_TOKEN_MINUTES=2 to test expiry. */
  tokenMinutes: number;
  /** Share of normal jobs that end FAILED (0 to 1). */
  failureRate: number;
  /** Share of API calls (except login) answered with a random 500 (0 to 1). */
  random500Rate: number;
  /** 1 = real speed, 0.1 = ten times faster. Applies to job stages. */
  timeScale: number;
  /** Fake network delay for API calls, in ms. */
  latencyMs: number;
  /** Fake time the S3 upload takes, in ms. */
  uploadDelayMs: number;
  /** Make GET /targets return an empty list. */
  noTargets: boolean;
  /** Keep jobs in sessionStorage so a page reload doesn't lose them. */
  persist: boolean;
  now: () => number;
  random: () => number;
};

export const defaultOptions: MockOptions = {
  tokenMinutes: 60,
  failureRate: 0.2,
  random500Rate: 0,
  timeScale: 1,
  latencyMs: 0,
  uploadDelayMs: 0,
  noTargets: false,
  persist: false,
  now: () => Date.now(),
  random: () => Math.random(),
};

function number(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Options for the in-browser mock, from NEXT_PUBLIC_MOCK_* variables (see .env.example). */
export function optionsFromEnv(): MockOptions {
  // Each variable is spelled out in full so Next can inline it at build time.
  return {
    ...defaultOptions,
    tokenMinutes: number(process.env.NEXT_PUBLIC_MOCK_TOKEN_MINUTES, 60) || 60,
    failureRate: number(process.env.NEXT_PUBLIC_MOCK_FAILURE_RATE, 0.2),
    random500Rate: process.env.NEXT_PUBLIC_MOCK_RANDOM_500 === 'true' ? 0.2 : 0,
    timeScale: number(process.env.NEXT_PUBLIC_MOCK_TIME_SCALE, 1) || 1,
    latencyMs: 250,
    uploadDelayMs: 2000,
    noTargets: process.env.NEXT_PUBLIC_MOCK_NO_TARGETS === 'true',
    persist: true,
  };
}
