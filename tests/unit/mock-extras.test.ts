import { afterEach, describe, expect, it, vi } from 'vitest';
import { optionsFromEnv } from '@/mocks/options';
import { createToken, readToken } from '@/mocks/token';

afterEach(() => vi.unstubAllEnvs());

describe('optionsFromEnv', () => {
  it('has sensible defaults: an hour-long login, 1 in 5 failures, real speed, persistence on', () => {
    const options = optionsFromEnv();
    expect(options).toMatchObject({
      tokenMinutes: 60,
      failureRate: 0.2,
      random500Rate: 0,
      timeScale: 1,
      noTargets: false,
      persist: true,
    });
    expect(options.latencyMs).toBeGreaterThan(0);
  });

  it('reads each setting from NEXT_PUBLIC_MOCK_*', () => {
    vi.stubEnv('NEXT_PUBLIC_MOCK_TOKEN_MINUTES', '2');
    vi.stubEnv('NEXT_PUBLIC_MOCK_FAILURE_RATE', '0');
    vi.stubEnv('NEXT_PUBLIC_MOCK_RANDOM_500', 'true');
    vi.stubEnv('NEXT_PUBLIC_MOCK_TIME_SCALE', '0.1');
    vi.stubEnv('NEXT_PUBLIC_MOCK_NO_TARGETS', 'true');

    expect(optionsFromEnv()).toMatchObject({
      tokenMinutes: 2,
      failureRate: 0,
      random500Rate: 0.2,
      timeScale: 0.1,
      noTargets: true,
    });
  });

  it('falls back to the default for a value that makes no sense', () => {
    vi.stubEnv('NEXT_PUBLIC_MOCK_TOKEN_MINUTES', 'soon');
    vi.stubEnv('NEXT_PUBLIC_MOCK_FAILURE_RATE', '-1');
    vi.stubEnv('NEXT_PUBLIC_MOCK_TIME_SCALE', '0');
    expect(optionsFromEnv()).toMatchObject({ tokenMinutes: 60, failureRate: 0.2, timeScale: 1 });
  });

  it('only switches random 500s on for exactly "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_MOCK_RANDOM_500', 'yes');
    expect(optionsFromEnv().random500Rate).toBe(0);
  });
});

describe('mock tokens', () => {
  const user = { username: 'demo', role: 'user' as const };
  const now = Date.parse('2026-03-01T12:00:00Z');
  const forge = (payload: unknown, signature = 'mock-signature') =>
    `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.${signature}`;

  it('a token reads back as the same user, until it expires', () => {
    const token = createToken(user, now, 120);
    expect(readToken(token, now + 119_000)).toEqual(user);
    expect(readToken(token, now + 121_000)).toBeNull();
  });

  it('rejects anything that is not one of our tokens', () => {
    expect(readToken('', now)).toBeNull();
    expect(readToken('not-a-token', now)).toBeNull();
    expect(readToken('a.b', now)).toBeNull();
    expect(readToken('a.!!!.mock-signature', now)).toBeNull();
    expect(
      readToken(forge({ sub: 'demo', role: 'user', exp: now / 1000 + 60 }, 'other-signature'), now),
    ).toBeNull();
  });

  it('rejects a token with a missing or wrong claim', () => {
    const exp = now / 1000 + 60;
    expect(readToken(forge({ role: 'user', exp }), now)).toBeNull(); // no user
    expect(readToken(forge({ sub: 'demo', role: 'admin', exp }), now)).toBeNull(); // unknown role
    expect(readToken(forge({ sub: 'demo', role: 'user' }), now)).toBeNull(); // no expiry
    expect(readToken(forge({ sub: 7, role: 'user', exp }), now)).toBeNull(); // user is not text
    expect(readToken(forge({ sub: 'demo', role: 'user', exp: 'later' }), now)).toBeNull();
  });
});
