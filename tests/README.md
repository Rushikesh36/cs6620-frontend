# Tests

- `npm test` runs every unit and component test once (Vitest, jsdom, React Testing Library).
- `npm run test:coverage` does the same and prints a coverage table.
- `npm run test:watch` re-runs tests as you edit.
- `npm run test:e2e` runs the end-to-end tests (Playwright, real Chromium, see below).

Tests live in `tests/unit/`, one file per piece of the app, with shared helpers in `tests/unit/support/`.

## What the brief (section 12) asks for, and where it is tested

| Requirement                                                          | Test file                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Zod schemas accept valid responses and reject invalid ones           | `schemas.test.ts`, `config.test.ts`                                  |
| API client: auth header added                                        | `api-client.test.ts`, `use-api.test.tsx`                             |
| API client: a 401 triggers logout                                    | `api-client.test.ts`, `use-api.test.tsx`, `auth-provider.test.tsx`   |
| API client: errors become `ApiError`                                 | `api-client.test.ts`                                                 |
| API client: the timeout works                                        | `api-client.test.ts`                                                 |
| Project ID validation rules                                          | `project-id.test.ts`, `new-scan.test.tsx`, `project-picker.test.tsx` |
| Zip file validation (type and size)                                  | `zip-file.test.ts`, `upload-zone.test.tsx`                           |
| Status badge and severity badge show the right label for every value | `badges.test.tsx`, `findings-components.test.tsx`                    |
| Polling stops when a scan is COMPLETED or FAILED                     | `polling.test.tsx`                                                   |
| CSV export escapes commas, quotes and newlines                       | `csv.test.ts`, `findings-panel.test.tsx`                             |

Beyond the brief: contrast ratios for the theme and every badge colour (`contrast.test.ts`), the
Content Security Policy (`csp.test.tsx`), the mock backend end to end (`mock-backend.test.ts`,
`mock-persistence.test.ts`, `upload-mock-s3.test.ts`), the auth session (`auth-*.test.*`), the
config loader (`config-load.test.ts`, `config-provider.test.tsx`), and every page's states.

## Conventions

- Test what a person sees and does (labels, roles, text), not how the code is built.
- Fake only what you must. Components that fetch data mock the hook (`vi.mock('@/hooks/...')`);
  the API client, mock backend and upload helper are tested against each other for real.
- Fake timers break React Testing Library's own waiting, so prefer real timers with `waitFor`,
  or fake only `Date`.
- A few files start with `// @vitest-environment node`, because the real `fetch` in Node does
  not accept jsdom's `AbortSignal`.

## End-to-end tests (`tests/e2e/`)

`npm run test:e2e` builds the site with the mock backend compiled in (`npm run build:e2e`: scans
finish in about 2 seconds and never fail by chance), serves the `out/` folder with a tiny server that
behaves like an S3 website (`serve.mjs`: `/folder/` gives its `index.html`, unknown addresses give
`404.html` with a 404 status, and it answers `/config.json` itself), and drives it in Chromium. So
these tests run the real production build, including the Content Security Policy and the service
worker. Install the browser once with `npx playwright install chromium`.

The build overwrites `out/`. Run `npm run build` again before deploying.

| Brief (section 12)                                                          | Test                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Wrong password shows an error, demo / demo123 works                         | `auth.spec.ts`                                                                  |
| Code scan: upload a zip, watch it complete, open its findings               | `scans.spec.ts`                                                                 |
| App scan on Juice Shop reaches a final status                               | `scans.spec.ts`                                                                 |
| Failed scan shows the error, "Start the same scan again" pre-fills the form | `scans.spec.ts`                                                                 |
| Expired token goes to /login with the session expired message               | `auth.spec.ts` (two ways: the server refuses the token, and the clock runs out) |
| Findings filters and search update the table and the address                | `findings.spec.ts`                                                              |

Also covered: logging out, the 404 page, paging, the details drawer, CSV export, the three project
tabs, the CSP being enforced by the browser, and the token staying out of localStorage, the address
and the S3 upload.

Every test also fails if the page breaks the Content Security Policy or throws an uncaught error
(`fixtures.ts`), even when the screen looks right.
