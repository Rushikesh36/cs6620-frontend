export const POLL_INTERVAL_MS = 5_000;
export const MAX_POLL_DELAY_MS = 60_000;

/**
 * How long to wait before asking again. Normally 5 seconds. After each failed attempt in a
 * row the wait doubles: 5s, 10s, 20s, 40s, then 60s at most. One good answer resets it.
 */
export function pollDelay(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return POLL_INTERVAL_MS;
  return Math.min(POLL_INTERVAL_MS * 2 ** (consecutiveFailures - 1), MAX_POLL_DELAY_MS);
}
