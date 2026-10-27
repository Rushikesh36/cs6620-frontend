import { defineConfig, devices } from '@playwright/test';

// The end-to-end tests run against a production build of the site (static files, like on S3)
// with the mock backend compiled in, so they need no real API.
// `npm run build:e2e` makes scans finish in about 2 seconds and never fail by chance.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 25_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build:e2e && node tests/e2e/serve.mjs',
    url: 'http://localhost:4173/login/',
    timeout: 300_000,
    reuseExistingServer: false,
  },
});
