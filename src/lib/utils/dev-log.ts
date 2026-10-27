/** Warnings for developers only: silent in production builds. */
export function devWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console -- the one place console is allowed, and only outside production
  console.warn(...args);
}
