import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from '@/lib/config';

describe('parseConfig', () => {
  it('accepts a valid config and trims a trailing slash from apiBaseUrl', () => {
    expect(parseConfig({ apiBaseUrl: 'https://a.example.com/', environment: 'lab' })).toEqual({
      apiBaseUrl: 'https://a.example.com',
      environment: 'lab',
    });
  });

  it('explains a missing field in plain words', () => {
    expect(() => parseConfig({ apiBaseUrl: 'https://a.example.com' })).toThrowError(ConfigError);
    try {
      parseConfig({ apiBaseUrl: 'https://a.example.com' });
    } catch (error) {
      expect((error as ConfigError).details).toEqual(['"environment" is missing']);
    }
  });

  it('rejects non-http URLs, empty environment and non-objects', () => {
    expect(() => parseConfig({ apiBaseUrl: 'ftp://a.example.com', environment: 'x' })).toThrow();
    expect(() => parseConfig({ apiBaseUrl: 'nope', environment: 'x' })).toThrow();
    expect(() => parseConfig({ apiBaseUrl: 'https://a.example.com', environment: '  ' })).toThrow();
    expect(() => parseConfig('hello')).toThrow();
  });
});
