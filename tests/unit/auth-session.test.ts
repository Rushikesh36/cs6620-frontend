import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeExpiresAt, decodeJwtExp } from '@/lib/auth/jwt';
import {
  clearSession,
  EXPIRY_WARNING_MS,
  isExpiringSoon,
  readSession,
  writeSession,
} from '@/lib/auth/session';

function fakeJwt(payload: unknown): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.sig`;
}

describe('decodeJwtExp', () => {
  it('reads exp from a JWT payload', () => {
    expect(decodeJwtExp(fakeJwt({ exp: 1_900_000_000, sub: 'demo' }))).toBe(1_900_000_000);
  });

  it('returns null for tokens that are not readable JWTs', () => {
    expect(decodeJwtExp('not-a-jwt')).toBeNull();
    expect(decodeJwtExp('a.b.c')).toBeNull();
    expect(decodeJwtExp(fakeJwt({ sub: 'demo' }))).toBeNull();
    expect(decodeJwtExp(fakeJwt({ exp: 'soon' }))).toBeNull();
    expect(decodeJwtExp('')).toBeNull();
  });
});

describe('computeExpiresAt', () => {
  const now = 1_000_000_000_000;

  it('uses the earlier of expiresIn and the token exp', () => {
    const tokenEarlier = fakeJwt({ exp: now / 1000 + 600 });
    expect(computeExpiresAt(tokenEarlier, 3600, now)).toBe(now + 600_000);

    const expiresInEarlier = fakeJwt({ exp: now / 1000 + 7200 });
    expect(computeExpiresAt(expiresInEarlier, 3600, now)).toBe(now + 3_600_000);
  });

  it('falls back to expiresIn when the token has no readable exp', () => {
    expect(computeExpiresAt('opaque-token', 120, now)).toBe(now + 120_000);
  });
});

describe('isExpiringSoon', () => {
  it('is true within the last 5 minutes and false before', () => {
    const now = 1_000_000;
    expect(isExpiringSoon(now + EXPIRY_WARNING_MS, now)).toBe(true);
    expect(isExpiringSoon(now + EXPIRY_WARNING_MS + 1, now)).toBe(false);
    expect(isExpiringSoon(now - 1, now)).toBe(true);
  });
});

describe('session storage', () => {
  const user = { username: 'demo', role: 'user' as const };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('saves and restores a session', () => {
    const session = { token: 't', user, expiresAt: Date.now() + 60_000 };
    writeSession(session);
    expect(readSession()).toEqual(session);
  });

  it('keeps the token in sessionStorage only, never localStorage', () => {
    writeSession({ token: 'secret-token', user, expiresAt: Date.now() + 60_000 });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
  });

  it('drops and clears a session that has already expired', () => {
    writeSession({ token: 't', user, expiresAt: Date.now() - 1 });
    expect(readSession()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('ignores damaged data', () => {
    sessionStorage.setItem('ush-session', '{not json');
    expect(readSession()).toBeNull();
    sessionStorage.setItem(
      'ush-session',
      JSON.stringify({ token: 't', user: { username: 'x', role: 'admin' }, expiresAt: 1 }),
    );
    expect(readSession()).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSession()).toBeNull();
    expect(() => writeSession({ token: 't', user, expiresAt: 1 })).not.toThrow();
    expect(() => clearSession()).not.toThrow();
  });
});
