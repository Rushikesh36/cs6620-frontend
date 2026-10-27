import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatFullDateTime,
  formatNumber,
  formatRelativeTime,
} from '@/lib/utils/format';

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [999, '0s'],
    [45_000, '45s'],
    [60_000, '1m 0s'],
    [134_000, '2m 14s'],
    [3_599_000, '59m 59s'],
    [3_900_000, '1h 5m'],
    [90_000_000, '1d 1h'],
  ])('%i ms is %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('shows 0s for negative or invalid input', () => {
    expect(formatDuration(-5000)).toBe('0s');
    expect(formatDuration(Number.NaN)).toBe('0s');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-03-01T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('says "just now" for the last few seconds, and for times slightly in the future', () => {
    expect(formatRelativeTime(ago(2000), now)).toBe('just now');
    expect(formatRelativeTime(new Date(now + 30_000), now)).toBe('just now');
  });

  it('counts seconds, minutes, hours and days', () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe('20 seconds ago');
    expect(formatRelativeTime(ago(3 * 60_000), now)).toBe('3 minutes ago');
    expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe('2 hours ago');
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe('3 days ago');
  });

  it('does not crash on an invalid date', () => {
    expect(formatRelativeTime('not a date', now)).toBe('Unknown time');
  });
});

describe('formatFullDateTime', () => {
  it('includes the date and the time', () => {
    const text = formatFullDateTime(new Date(2026, 2, 1, 15, 4, 5));
    expect(text).toContain('Mar 1, 2026');
    expect(text).toMatch(/3:04:05\s?PM/);
  });

  it('does not crash on an invalid date', () => {
    expect(formatFullDateTime('nope')).toBe('Unknown time');
  });
});
