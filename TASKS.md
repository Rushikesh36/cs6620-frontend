# Tasks

Progress: 16 / 26 done (62%)
[#########################...............]

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
| 10  | Shared components: status badge, severity badge, relative time, copy button, empty state, error state, skeletons | ✅ Approved    | 2          |
| 11  | TanStack Query setup, query keys, resource hooks                                                                 | ✅ Approved    | 5, 7       |
| 12  | New scan page, part 1: scan type step, project ID step, recent projects                                          | ✅ Approved    | 9, 10      |
| 13  | New scan page, part 2: zip upload zone with validation                                                           | ✅ Approved    | 12         |
| 14  | New scan page, part 3: DAST target selection from the allow-list                                                 | ✅ Approved    | 11, 12     |
| 15  | New scan page, part 4: review step, submit flow, XHR upload with progress, retry, beforeunload                   | ✅ Approved    | 13, 14     |
| 16  | Scan detail page: header, status timeline, polling with backoff and tab visibility                               | ✅ Approved    | 10, 11     |
| 17  | Scan detail page: completed summary, failed state, "start the same scan again", long-running warning             | 🔨 In progress | 15, 16     |
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
- Task 16: the scan detail page polls one thing, `GET /scans/{jobId}`, every 5 seconds until COMPLETED or FAILED. It pauses while the tab is hidden and asks again the moment the tab is shown.
- Task 16: after failed polls the wait doubles (5s, 10s, 20s, 40s, then 60s at most) and one good answer resets it. The last good scan stays on screen with "Reconnecting...". TanStack's own failure counters reset on every fetch, so consecutive failures are counted in `useScan`.
- Task 16: a failed poll is not retried on top of the back-off, but the very first load is retried twice. A 404 on the first load shows "Scan not found" with a link back to the scans list.
- Task 16: the timeline shows Created, Queued, Running and Completed or Failed with the time of each and how long it took after the step before. A scan that failed before a scanner picked it up shows Running as "skipped". The live "Running for 3m 12s" counter ticks every second only while RUNNING.
- Task 16: the metadata section (requested by, image tag, created/started/finished) from section 6.4 is built in Task 17 with the other detail-page parts (summary, failure box, run-again button, slow-scan warning); it wasn't listed under either task, so I'm recording where it goes.
- Task 16: `useScan` passes `retry` only while polling. Passing `retry: undefined` would silently replace the app-wide retry setting (a test caught that).
- Task 15: `uploadFile` (XHR) sends exactly the pre-signed headers and no Authorization header, and takes an AbortSignal to cancel. XHR, not fetch, because only XHR reports upload progress.
- Task 15: "Start scan" runs create → upload (code scans only) → queue → go to `/scans/detail/?jobId=…`. A failed step is retried from that step: a failed upload reuses the same job and the same upload URL; a failed queue step does not upload again.
- Task 15: the upload link counts as expired 5 seconds before `expiresIn` runs out. After that, "Start over with a new scan" creates a new job and tells the user why, because the old URL can't work any more.
- Task 15: closing or reloading the tab mid-run shows the browser's "Leave site?" prompt. Moving to another page inside the app cancels the upload and stops, so it can't pull the user back later. (The browser has no way to ask "leave?" for in-app links, so that case just cancels. It can leave a CREATED job that was never queued.)
- Task 15: Start and Back are disabled while a run is in progress. A guard inside the hook (not only the disabled button) also stops a double click from making two jobs.
- Task 15: screen readers hear the stage, and the upload in 25% steps rather than every percent. The progress bar itself is updated for every event.
- Task 15: the project is added to the recent list when the job is created (Task 12 had also added it at the project step).
- Task 15: the mock S3 now answers the browser's CORS preflight (`OPTIONS`) and sends CORS headers, like a real bucket must. This changed approved Task 6 code, and is needed to test the real XHR helper in jsdom.
- Task 14: the target cards come only from `GET /targets`; there is no text field, so a URL can't be typed. A chosen or pre-filled (`&target=`) app only counts while it is still on the list the server just sent, so a made-up link value can never be submitted.
- Task 14: the card styling from Task 12 moved into one shared `OptionCard`, now used by both the scan type and the test app steps, so they can't drift apart.
- Task 14: loading shows card-shaped skeletons, an error shows the server message with Try again, and an empty list shows "No test apps are registered yet." with Continue disabled. The safety note is always visible.
- Task 13: a file is accepted only if its name ends in `.zip` AND its browser-reported type is a zip type. Windows reports `application/x-zip-compressed`, and some systems report nothing or `application/octet-stream`, so those pass when the extension is right. This check only saves a wasted upload: the browser can't see inside a file, so the backend must validate it too (added to the backend page's open items).
- Task 13: limit is exactly 50 MB (52,428,800 bytes, 1024-based); an empty file is rejected too. A rejected file never replaces one that was already accepted.
- Task 13: the drop zone is a real file input inside a label, so keyboard and screen reader use needs no extra code. Dropping several files shows "Choose one .zip file at a time."
- Task 13: the step title for the third step now depends on the type ("Upload your code" / "Choose a test app"), and step 4 is titled "Review and start" (built in Task 15).
- Task 12: the new-scan page is a 4-step wizard (type, project, upload or target, review). This task builds steps 1 and 2; steps 3 and 4 show a "built in Task N" note until Tasks 13 to 15. The third step is named after the type (Upload code / Choose app).
- Task 12: the scan type cards are real radio buttons, so arrow keys and screen readers work without extra code, and the selected card also shows a check mark (not colour alone).
- Task 12: project ID rules live in one place (`lib/validation/project-id.ts`) with a plain-words message for each problem. The ID is not trimmed or lower-cased for the user: a space or capital letter is reported, not silently changed.
- Task 12: a project ID is added to the recent list when the user continues past step 2 (not only when a scan is created), so suggestions work as soon as you have used an ID. Task 15 will add it again on creation, which just moves it to the front.
- Task 12: `/scans/new/?type=SAST|DAST&project=<id>` pre-fills the form and starts at step 2, for Task 17's "Start the same scan again". Invalid values are ignored. The target parameter is added with the target step in Task 14.
- Task 11: `useApi()` builds the logged-in API client from the config URL and the current token. A 401 logs out as "expired", and only once even if several requests fail together.
- Task 11: `SessionProviders` puts the query cache and login together and empties the cache on every logout, so the next person on the tab never sees the previous person's data.
- Task 11: retry policy: queries retry twice, and only for things that can pass by themselves (no answer, timeout, 5xx, 408, 429). 4xx answers and unreadable responses are not retried. Mutations never retry, so a failed "create scan" can't make two jobs.
- Task 11: `useScan` treats COMPLETED and FAILED as final (kept forever, no refetch on focus) and unfinished scans as always stale. The 5-second polling with back-off and tab-visibility pause is Task 16, as planned. `useProjectScans` is an infinite query (cursor "Load more") and takes an optional `refetchInterval` for Task 18's 15-second refresh.
- Task 11: no React Query devtools (a new dependency you didn't ask for).
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
