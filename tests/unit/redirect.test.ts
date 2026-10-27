import { describe, expect, it } from 'vitest';
import { DEFAULT_REDIRECT, safeRedirectPath } from '@/lib/auth/redirect';

describe('safeRedirectPath', () => {
  it('keeps internal paths, including query strings and hashes', () => {
    expect(safeRedirectPath('/scans/new/')).toBe('/scans/new/');
    expect(safeRedirectPath('/scans/detail/?jobId=abc-123')).toBe('/scans/detail/?jobId=abc-123');
    expect(safeRedirectPath('/projects/detail/?projectId=demo-app&scanType=SAST#top')).toBe(
      '/projects/detail/?projectId=demo-app&scanType=SAST#top',
    );
  });

  it('falls back to the dashboard when there is nothing to go back to', () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath('')).toBe(DEFAULT_REDIRECT);
  });

  it.each([
    ['an absolute URL', 'https://evil.example/steal'],
    ['a protocol-relative URL', '//evil.example'],
    ['a protocol-relative URL with a path', '//evil.example/dashboard'],
    ['a backslash trick', '/\\evil.example'],
    ['a backslash after the first slash', '/\\/evil.example'],
    ['a tab that browsers strip', '/\t/evil.example'],
    ['a newline that browsers strip', '/\n/evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a path without a leading slash', 'dashboard'],
    ['a leading space', ' /dashboard'],
    ['an @ host trick', '@evil.example'],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirectPath(value)).toBe(DEFAULT_REDIRECT);
  });

  it('does not send a logged-in user back to the login page', () => {
    expect(safeRedirectPath('/login')).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath('/login/')).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath('/login/?reason=expired')).toBe(DEFAULT_REDIRECT);
  });
});
