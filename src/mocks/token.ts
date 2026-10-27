import type { User } from '@/lib/api/schemas';

// A JWT-shaped token so the frontend can read `exp` like it will with the real backend.
// The signature is fake: this only ever runs in the mock.
const FAKE_SIGNATURE = 'mock-signature';

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(part: string): unknown {
  const padded = part
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(part.length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

export function createToken(user: User, nowMs: number, ttlSeconds: number): string {
  const iat = Math.floor(nowMs / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: user.username, role: user.role, iat, exp: iat + ttlSeconds });
  return `${header}.${payload}.${FAKE_SIGNATURE}`;
}

/** Returns the user if the token is one of ours and has not expired. */
export function readToken(token: string, nowMs: number): User | null {
  try {
    const [, payloadPart, signature] = token.split('.');
    if (!payloadPart || signature !== FAKE_SIGNATURE) return null;
    const payload = decode(payloadPart) as { sub?: unknown; role?: unknown; exp?: unknown };
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.role !== 'user' && payload.role !== 'ci') return null;
    if (payload.exp * 1000 <= nowMs) return null;
    return { username: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
