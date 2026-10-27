# Tasks

Progress: 9 / 26 done (35%)
[##############..........................]

| #   | Task                                                                                                             | Status         | Depends on |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| 1   | Project setup: Next.js, TypeScript strict, Tailwind, ESLint, Prettier, npm, static export config                 | ✅ Approved    |            |
| 2   | shadcn/ui setup, base theme (red accent), dark mode toggle, fonts                                                | ✅ Approved    | 1          |
| 3   | Runtime config loader (/config.json), ConfigProvider, configuration error screen                                 | ✅ Approved    | 1, 2       |
| 4   | Zod schemas and TypeScript types for the full API contract (+ schema tests)                                      | ✅ Approved    | 1          |
| 5   | API client (fetch wrapper, ApiError, timeout, auth header) and endpoints, with unit tests                        | ✅ Approved    | 3, 4       |
| 6   | MSW mock backend: login, targets, create/start scan, job lifecycle, findings, error flags                        | ✅ Approved    | 4          |
| 7   | Auth: AuthProvider, sessionStorage, token expiry, expiry banner, logout                                          | ✅ Approved    | 3, 5       |
| 8   | Login page with form validation and error states                                                                 | ✅ Approved    | 6, 7       |
| 9   | Route guard and authenticated app shell (header, sidebar, mobile nav, environment badge)                         | ✅ Approved    | 7, 8       |
| 10  | Shared components: status badge, severity badge, relative time, copy button, empty state, error state, skeletons | 🔍 In review   | 2          |
| 11  | TanStack Query setup, query keys, resource hooks                                                                 | ⬜ Not started | 5, 7       |
| 12  | New scan page, part 1: scan type step, project ID step, recent projects                                          | ⬜ Not started | 9, 10      |
| 13  | New scan page, part 2: zip upload zone with validation                                                           | ⬜ Not started | 12         |
| 14  | New scan page, part 3: DAST target selection from the allow-list                                                 | ⬜ Not started | 11, 12     |
| 15  | New scan page, part 4: review step, submit flow, XHR upload with progress, retry, beforeunload                   | ⬜ Not started | 13, 14     |
| 16  | Scan detail page: header, status timeline, polling with backoff and tab visibility                               | ⬜ Not started | 10, 11     |
| 17  | Scan detail page: completed summary, failed state, "start the same scan again", long-running warning             | ⬜ Not started | 15, 16     |
| 18  | Scans list page with filters, load more, auto-refresh                                                            | ⬜ Not started | 10, 11     |
| 19  | Projects list page                                                                                               | ⬜ Not started | 10, 12     |
| 20  | Project detail page: findings table, filters, search, sort, URL state, pagination                                | ⬜ Not started | 11, 18     |
| 21  | Finding detail drawer and CSV export                                                                             | ⬜ Not started | 20         |
| 22  | Dashboard page: summary cards, recent scans, empty state                                                         | ⬜ Not started | 18         |
| 23  | 404 page, CSP meta tag, accessibility pass (keyboard, focus, aria-live, contrast)                                | ⬜ Not started | 1-22       |
| 24  | Unit and component tests to cover section 12 (gaps only; most written alongside tasks)                           | ⬜ Not started | 1-22       |
| 25  | Playwright end-to-end tests from section 12                                                                      | ⬜ Not started | 1-23       |
| 26  | Deploy script, caching headers, README                                                                           | ⬜ Not started | 1-25       |

## Decisions log

- Plan v1: tests for schemas/client are written inside Tasks 4-5 (not deferred to 24) so each task is verifiable alone. Task 24 fills the remaining gaps.
- Plan v1: query-param routes (`/scans/detail?jobId=`) instead of dynamic segments, because of static export.
- Task 1 (revised): package manager is npm, not pnpm, per reviewer request. Lockfile is package-lock.json.
- Task 10: toasts use `sonner` with our own small wrapper (`ui/toaster.tsx`). shadcn's version needs `next-themes`, and we already have a theme provider. The "You have been logged out." notice from Task 8 is now a toast, as planned.
- Task 10: status and severity colours live in the two badge files, as fixed colours separate from the accent, so a future accent change can't turn "Failed" or "High" a different colour. Labels are Title case (Running, High) and always shown next to the colour.
- Task 10: `RelativeTime` is keyboard-focusable so its tooltip (full local date and time) works without a mouse. It re-reads the clock every 30 seconds so "3 minutes ago" keeps moving.
- Task 10: the copy button uses `navigator.clipboard` when the page has it and a hidden text box otherwise (plain HTTP has no Clipboard API). A failure shows an error toast instead of failing silently.
- Task 10: only generic skeletons (`TableSkeleton`, `CardGridSkeleton`) are built here. Each page task shapes its own loading state from them once its layout exists.
- Task 10: the Dashboard placeholder temporarily hosts a component preview. Task 22 replaces that page.
- Task 9: six placeholder pages (`dashboard`, `scans`, `scans/new`, `scans/detail`, `projects`, `projects/detail`) say "This page is built in Task N". They exist only so the guard, the sidebar and the mobile menu can be tried now; each is replaced by its own task (22, 18, 12, 16, 19, 20).
- Task 9: `AuthProvider` (approved in Task 7) gained `logoutReason`. Without it the guard and the logout both redirect to `/login`, and the guard's redirect wins and drops the "session expired" message.
- Task 9: the expiry banner moved from the root layout into the app shell and sits in the page flow above the header instead of covering it.
- Task 9: the shell fills the window and only the content area scrolls, so the header and sidebar never move.
- Task 9: the route guard only controls what the browser shows. The API refusing requests without a valid token is the real protection. In the prerendered HTML of a protected page, the visible part is only a loader, but Next also embeds the page's structure in a payload script (checked). On a static site that is expected, and all of it is public anyway. So protected pages must never hold data or secrets in their source: everything private comes from the API, after login.
- Task 8: `@hookform/resolvers` pinned to v5. Version 6 has an optional peer on `effect@4`, which clashes with the `effect@3` that shadcn's tooling already installs, and I didn't want to force the install.
- Task 8: the "You have been logged out." message is shown on the login page itself. The brief asks for a toast; the toast library arrives with the shared components (Task 10), and I'll move it there then.
- Task 8: `?next=` goes through `safeRedirectPath`, which parses it as a URL and rejects anything that isn't on this site (other hosts, `//host`, backslashes, tabs and newlines that browsers strip, `javascript:`). The default destination is `/dashboard/`, which doesn't exist until Task 22.
- Task 7: a session ends at the earlier of `expiresIn` (from login) and the token's own `exp`, so we never believe a session lasts longer than either says.
- Task 7: expiry is checked once a second against the clock (not one long timer), so it still works after a laptop sleeps. The check logs out only once, even if two ticks fire before React reacts (a test caught that).
- Task 7: logging out (by hand, on expiry or on a 401) goes to `/login/?reason=signed-out` or `?reason=expired`. The login page (Task 8) turns that into the message; until then `/login/` shows the 404 page.
- Task 7: `AuthProvider` takes an `onLogout` callback so Task 11 can clear the TanStack Query cache without Auth depending on it. Task 11 also builds the logged-in API client, using `token` and `logout('expired')` as its 401 handler.
- Task 7: temporary "session preview" on the home page lets you try login, expiry and logout. Task 9 replaces that page.
- Task 7: Testing Library cleanup registered in `tests/setup.ts` (Vitest globals are off).
- Task 6: MSW is v3, where `onUnhandledRequest` is now `onUnhandledFrame`. Handlers are built for the configured `apiBaseUrl`, so they only catch API calls, never page loads.
- Task 6: job timing, counted from the `/start` call: QUEUED for 5s, RUNNING for 15s, final at 20s. All stages scale with `NEXT_PUBLIC_MOCK_TIME_SCALE`. (The brief said QUEUED "after ~3s"; `/start` must answer QUEUED right away per the contract, so I used the stage lengths instead.)
- Task 6: special projects: `stuck-demo` stays RUNNING forever, `fail-demo` always fails. `demo-app` starts with 4 seeded scans (SAST, DAST, one FAILED) so list pages have data. Mock users: `demo` / `demo123` and `ci-bot` / `ci-bot123` (the brief gave no password for ci-bot).
- Task 6: the mock keeps jobs in sessionStorage so a page reload doesn't lose the scan you were watching.
- Task 6: `NEXT_PUBLIC_USE_MOCKS` is always defined in next.config.ts. Next only inlines variables that exist at build time, and inlining is what lets the bundler drop all mock code from normal builds (checked: no handlers, data or MSW in a normal `out/`).
- Task 6: `msw/browser` is aliased in next.config.ts to a stub for the server-side prerender pass and to the real file for the browser, because MSW marks it as browser-only.
- Task 6: `public/mockServiceWorker.js` (generated by `msw init`, inert unless mocks start) is copied into `out/`. Task 26's deploy script must exclude it from the S3 sync.
- Task 5: the client is a factory (`createApiClient`) that takes `baseUrl`, `getToken` and `onUnauthorized`, so it doesn't depend on the auth provider that arrives in Task 7. Task 11 wires it to config and auth.
- Task 5: `ApiError` has `status` plus a `kind` (`http`, `network`, `timeout`, `invalid_response`). Network and timeout errors use status 0. A cancel from the caller (TanStack Query) is re-thrown untouched, not wrapped.
- Task 5: when the server sends an error message we show it; otherwise a friendly default per status (401, 403, 404, 5xx). Login passes `auth: false`, so a wrong password is not treated as an expired session.
- Task 5: `createScan` rejects a SAST response that has no `upload` block, since the contract promises one.
- Task 5: the only `console` use is `devWarn` (dev builds only), as required for schema-mismatch warnings.
- Task 4: Vitest 5 + jsdom + React Testing Library set up here (needed for the schema tests). Tests live in `tests/unit/`; `@` aliases `src/`.
- Task 4: schemas strip unknown fields (Zod default) so the backend can add fields safely. Dates are validated leniently (anything `Date.parse` accepts).
- Task 4: `imageTag` accepts null/missing (contract shows a string, but a job that hasn't started may have none). `POST /scans` response has optional `upload`; callers check it for SAST.
- Task 3: `config.json` is fetched with `cache: 'no-store'` and a 10s timeout. A trailing slash on `apiBaseUrl` is trimmed so endpoint paths can start with `/`.
- Task 3: the build copies a local `public/config.json` into `out/`. Task 26's deploy script must exclude `config.json` from `aws s3 sync` so it never overwrites the Terraform-written file.
- Task 2: shadcn preset `radix-nova` (Radix primitives as the spec requires; the default preset uses Base UI). Accent is deep teal `oklch(0.5 0.1 195)` with faintly teal-tinted neutrals (red was rejected at review as too close to Claude's palette; indigo was also rejected). Red is now reserved for HIGH severity and FAILED. Dark mode uses a lighter teal for contrast.
- Task 2: system font stacks instead of Geist from Google Fonts, so no external font host is needed and the CSP stays tight.
- Task 2: theme choice (light/dark/system) is stored in localStorage; a tiny `beforeInteractive` script applies it before first paint.
- Task 1: Next 16.4.3, React 19.3.1, Tailwind 4.3, ESLint 10. TypeScript pinned to 5.x (latest is 7.x, which the Next/ESLint toolchain doesn't reliably support yet).
- Task 1: `noUncheckedIndexedAccess` enabled on top of `strict`, to catch undefined array/record lookups.
- Task 1: `typecheck` runs `next typegen` first so route types exist on a clean checkout.
- Task 1: `turbopack.root` pinned in next.config.ts because a lockfile higher in the home directory confused root detection.
- Task 1: Lint rules `no-console`, `no-explicit-any` and `react/no-danger` set to error to enforce the code-quality rules from the start.

## Backend requests

- (Likely) `GET /scans?limit=&cursor=` returning recent scans across all projects, for the dashboard. Will confirm in Task 22.
- Please confirm `imageTag` can be null/absent on CREATED/QUEUED jobs, and that `expiresIn` in the upload block is in seconds.
