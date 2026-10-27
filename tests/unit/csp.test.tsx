import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectPolicy } from '@/components/security/connect-policy';
import { BASE_POLICY, connectPolicy, UPLOAD_SOURCE } from '@/lib/csp';

const policies = () =>
  [...document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')].map((m) =>
    m.getAttribute('content'),
  );

afterEach(() => document.getElementById('connect-policy')?.remove());

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe('BASE_POLICY', () => {
  it('does not run plugins, frames or foreign form targets, and fixes the base address', () => {
    expect(directive(BASE_POLICY, 'object-src')).toBe("object-src 'none'");
    expect(directive(BASE_POLICY, 'frame-src')).toBe("frame-src 'none'");
    expect(directive(BASE_POLICY, 'form-action')).toBe("form-action 'self'");
    expect(directive(BASE_POLICY, 'base-uri')).toBe("base-uri 'self'");
  });

  it('only loads scripts from this site (plus the inline start-up scripts a static page needs)', () => {
    expect(directive(BASE_POLICY, 'script-src')).toBe("script-src 'self' 'unsafe-inline'");
    expect(BASE_POLICY).not.toContain('unsafe-eval');
    expect(BASE_POLICY).not.toContain('http:');
    expect(BASE_POLICY).not.toMatch(/\*(?!\.)/); // no bare wildcard
  });

  it('leaves out connect-src and default-src, which the second policy sets once the API is known', () => {
    expect(BASE_POLICY).not.toContain('connect-src');
    expect(BASE_POLICY).not.toContain('default-src');
  });
});

describe('connectPolicy', () => {
  it('allows this site, the configured API and S3, and nothing else', () => {
    expect(connectPolicy('https://abc123.execute-api.us-east-1.amazonaws.com')).toBe(
      `connect-src 'self' https://abc123.execute-api.us-east-1.amazonaws.com ${UPLOAD_SOURCE}`,
    );
  });

  it('uses only the origin of the API address, so a stage name in the path is fine', () => {
    expect(connectPolicy('https://api.example.com/prod/v1')).toContain(
      "'self' https://api.example.com ",
    );
    expect(connectPolicy('https://api.example.com/prod/v1')).not.toContain('/prod');
  });

  it('keeps a port, and allows a plain-http API for a local backend', () => {
    expect(connectPolicy('http://localhost:4000')).toContain('http://localhost:4000');
  });

  it('allows uploads to S3 over https only', () => {
    expect(UPLOAD_SOURCE).toBe('https://*.amazonaws.com');
  });
});

describe('ConnectPolicy', () => {
  it('adds the second policy to the page', () => {
    render(<ConnectPolicy apiBaseUrl="https://api.example.com" enabled />);
    expect(policies()).toEqual([connectPolicy('https://api.example.com')]);
  });

  it('adds it only once, even if it renders again', () => {
    const { rerender } = render(<ConnectPolicy apiBaseUrl="https://api.example.com" enabled />);
    rerender(<ConnectPolicy apiBaseUrl="https://api.example.com" enabled />);
    render(<ConnectPolicy apiBaseUrl="https://api.example.com" enabled />);
    expect(policies()).toHaveLength(1);
  });

  it('does nothing when turned off, as in development', () => {
    render(<ConnectPolicy apiBaseUrl="https://api.example.com" enabled={false} />);
    expect(policies()).toEqual([]);
  });

  it('is off by default outside production, which is what the tests run in', () => {
    render(<ConnectPolicy apiBaseUrl="https://api.example.com" />);
    expect(policies()).toEqual([]);
  });
});
