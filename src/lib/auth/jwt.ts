// The browser only reads the expiry from the token. It cannot check the signature (it has no
// key, and shouldn't), so never use anything in the token to make a security decision.

/** The `exp` claim in seconds since 1970, or null if this is not a readable JWT. */
export function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const exp: unknown = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/**
 * When the session ends, in ms since 1970. Uses the earlier of the token's own `exp` and
 * `expiresIn` from the login response, so we never think a session lives longer than either says.
 */
export function computeExpiresAt(token: string, expiresInSeconds: number, nowMs: number): number {
  const fromExpiresIn = nowMs + expiresInSeconds * 1000;
  const exp = decodeJwtExp(token);
  return exp === null ? fromExpiresIn : Math.min(fromExpiresIn, exp * 1000);
}
