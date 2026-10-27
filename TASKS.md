# Tasks

Progress: 26 / 26 done (100%)
[########################################]

| #   | Task                                                                                                             | Status      | Depends on |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 1   | Project setup: Next.js, TypeScript strict, Tailwind, ESLint, Prettier, npm, static export config                 | ✅ Approved |            |
| 2   | shadcn/ui setup, base theme (red accent), dark mode toggle, fonts                                                | ✅ Approved | 1          |
| 3   | Runtime config loader (/config.json), ConfigProvider, configuration error screen                                 | ✅ Approved | 1, 2       |
| 4   | Zod schemas and TypeScript types for the full API contract (+ schema tests)                                      | ✅ Approved | 1          |
| 5   | API client (fetch wrapper, ApiError, timeout, auth header) and endpoints, with unit tests                        | ✅ Approved | 3, 4       |
| 6   | MSW mock backend: login, targets, create/start scan, job lifecycle, findings, error flags                        | ✅ Approved | 4          |
| 7   | Auth: AuthProvider, sessionStorage, token expiry, expiry banner, logout                                          | ✅ Approved | 3, 5       |
| 8   | Login page with form validation and error states                                                                 | ✅ Approved | 6, 7       |
| 9   | Route guard and authenticated app shell (header, sidebar, mobile nav, environment badge)                         | ✅ Approved | 7, 8       |
| 10  | Shared components: status badge, severity badge, relative time, copy button, empty state, error state, skeletons | ✅ Approved | 2          |
| 11  | TanStack Query setup, query keys, resource hooks                                                                 | ✅ Approved | 5, 7       |
| 12  | New scan page, part 1: scan type step, project ID step, recent projects                                          | ✅ Approved | 9, 10      |
| 13  | New scan page, part 2: zip upload zone with validation                                                           | ✅ Approved | 12         |
| 14  | New scan page, part 3: DAST target selection from the allow-list                                                 | ✅ Approved | 11, 12     |
| 15  | New scan page, part 4: review step, submit flow, XHR upload with progress, retry, beforeunload                   | ✅ Approved | 13, 14     |
| 16  | Scan detail page: header, status timeline, polling with backoff and tab visibility                               | ✅ Approved | 10, 11     |
| 17  | Scan detail page: completed summary, failed state, "start the same scan again", long-running warning             | ✅ Approved | 15, 16     |
| 18  | Scans list page with filters, load more, auto-refresh                                                            | ✅ Approved | 10, 11     |
| 19  | Projects list page                                                                                               | ✅ Approved | 10, 12     |
| 20  | Project detail page: findings table, filters, search, sort, URL state, pagination                                | ✅ Approved | 11, 18     |
| 21  | Finding detail drawer and CSV export                                                                             | ✅ Approved | 20         |
| 22  | Dashboard page: summary cards, recent scans, empty state                                                         | ✅ Approved | 18         |
| 23  | 404 page, CSP meta tag, accessibility pass (keyboard, focus, aria-live, contrast)                                | ✅ Approved | 1-22       |
| 24  | Unit and component tests to cover section 12 (gaps only; most written alongside tasks)                           | ✅ Approved | 1-22       |
| 25  | Playwright end-to-end tests from section 12                                                                      | ✅ Approved | 1-23       |
| 26  | Deploy script, caching headers, README                                                                           | ✅ Approved | 1-25       |

## Decisions log

- Plan v1: tests for schemas/client are written inside Tasks 4-5 (not deferred to 24) so each task is verifiable alone. Task 24 fills the remaining gaps.
- Plan v1: query-param routes (`/scans/detail?jobId=`) instead of dynamic segments, because of static export.
- Task 1 (revised): package manager is npm, not pnpm, per reviewer request. Lockfile is package-lock.json.
- All 26 tasks approved. (Tasks 18 to 26 were built back to back at the user's request and reviewed together afterwards.)
- Workflow change (after Task 17, at the user's request): the next task now starts right after the previous one is built and checked, without waiting for "approved". Finished-but-unreviewed tasks stay "🔍 In review" and are not counted as approved. Review comments on any of them are still handled as changes to that task.
- Task 26: `scripts/deploy.sh <bucket> [--dry-run] [--skip-build]` builds, then uploads in two passes: `_next/static/` first (one year, `immutable`, because the file names are hashed), then everything else with `Cache-Control: no-cache`. It never uploads or deletes `config.json` (Terraform owns it; the script only sets `no-cache` on it if it exists), leaves out `mockServiceWorker.js` and `config.example.json`, and refuses a build that contains the mock backend (the end-to-end build overwrites `out/`). It is tested against fake `aws` and `npm` commands, so the exact calls are checked, but it has **not been run against a real bucket**: no AWS credentials here. A real `aws` CLI did accept the call up to the credentials check.
- Task 26: `--delete` is on for both passes, as the brief asks. A tab opened before a deploy may need a reload once its old chunk files are gone.
- Task 26: the README covers the brief's list (what it does, running with mocks and against a lab, config.json, deploying, backend requirements including CORS and the S3 website settings, known limitations, backend requests) plus a troubleshooting section. `.nvmrc` (22) and `engines` (Node 20.9 or newer) pin the Node version.
- Task 25: the end-to-end tests run in real Chromium against a production build with the mock backend compiled in (`npm run build:e2e`: scans finish in ~2 seconds, no random failures), served by a small S3-like static server (`tests/e2e/serve.mjs`). So they exercise the real static export, the service worker and the Content Security Policy. 18 tests: the six from the brief (login, code scan, app scan, failed scan and re-run, expired token, filters and search) plus logging out, the 404 page, a session running out by itself, paging, the details drawer, CSV export, the tabs, history and dashboard, and security checks.
- Task 25: **this was the first time the app ran in a real browser.** Everything passed once the test selectors were right (they were too loose: Next keeps its own hidden `role="alert"` element). The CSP did not break the site, a request to another origin and a foreign iframe are both blocked by the browser, the login token is only in sessionStorage, and the S3 upload carries no Authorization header while every API call does.
- Task 25: every end-to-end test also fails on a CSP violation or an uncaught page error, so a visible pass can't hide a broken console.
- Task 25: the expired-token test works two ways: the server refuses the token (401 on the next request), and the clock runs out while you are on a page. Both end on `/login/?reason=expired` with the message.
- Task 25: `npm run build:e2e` overwrites `out/` (the same folder `npm run build` fills). Build again before deploying.
- Task 24: every unit and component test the brief lists in section 12 already existed, written with its task. This task mapped each one to its test file (`tests/README.md`), measured coverage, and filled the real gaps. Coverage went from 91% to 98.7% of statements (94.4% of branches). New tests cover: loading `config.json` and each way it can fail, the config provider (loader, error screen, Try again), the dark-mode toggle (system default, saved choice, following the OS), the mock-mode gate, the URL-state hook, the mock's settings, tokens, reload persistence and 400 errors.
- Task 24: added `@vitest/coverage-v8` as a dev-only dependency (`npm run test:coverage`), and deleted `PagePlaceholder`, which nothing used any more.
- Task 24: remaining uncovered lines are a handful of defensive branches (for example an impossible `new URL` failure in the redirect check).
- Task 23: the CSP is two `<meta>` policies, because the browser applies every policy it is given and a static page cannot know the API address. (1) A fixed one in every page's `<head>` (scripts and styles from this site only, no plugins or frames, forms only to this site). (2) Once `config.json` is loaded, a second one is added that limits requests to this site, the configured API origin and `https://*.amazonaws.com` (the S3 upload bucket's name isn't known up front). Both are only added in production builds, because the dev server needs connections a strict policy would block.
- Task 23: limits of a meta-tag CSP (to be written up in the README, Task 26): it cannot set `frame-ancestors`, `report-uri` or `sandbox`; it only protects what loads after the browser reads it, so the first request for `config.json` happens before the second policy; scripts need `'unsafe-inline'` because a static Next.js page carries its start-up data in inline scripts; and the upload allowance is the whole of `amazonaws.com` over https. The built JavaScript contains no `eval` or `new Function`, so the policy doesn't need `'unsafe-eval'`.
- Task 23: colour contrast is now measured, not assumed. A test converts the theme colours and the Tailwind colours used by the badges and notices to real contrast ratios and fails below WCAG AA (4.5 to 1 for text, 3 to 1 for control edges and focus rings). It found four problems that are fixed in the theme: hint text on a muted background (4.33), input borders (1.2 in light mode, 1.5 in dark), and the light focus ring (2.2). All badge, banner and notice colours already passed. Input borders and the focus ring are now noticeably darker than shadcn's defaults.
- Task 23: also fixed: the login page had no `<h1>` (the card title was a `div`), the 404 page was Next's default text, and "reduce motion" was only honoured by some animations. A global rule now covers all of them, including the shadcn components. A global visible focus outline covers anything without its own focus style.
- Task 23: not done: no automated axe-core run (it would be a new dev dependency; say if you want it), and no test with a real screen reader. Each relative time is a keyboard stop for its tooltip, so tables have many tab stops.
- Task 22: with no "all scans" endpoint (still listed under Backend requests), the dashboard asks for the newest 20 scans of each recent project (up to 10 projects, from this tab's list) and combines them. It waits until every project has answered, keeps going when some fail (with a "numbers are incomplete" note and Try again), and shows an error only when none could be loaded. Because it only asks for 20 scans per project, a very busy project can make "last 7 days" an undercount.
- Task 22: the cards are Scans in the last 7 days (by creation time), Running now, Failed in the last 7 days (by finish time), and New HIGH findings added up over the 10 most recent finished scans. New HIGH is red and says "Needs attention" when above 0. The recent scans table is the shared scans table with a Project column.
- Task 22: a first-time user (no recent projects) sees a short explanation of code scans and app scans and a "Start your first scan" button, and nothing is loaded. Scans from a project show up after it has been used or opened in this tab. The temporary component preview from Task 10 is gone from this page.
- Task 21: the details drawer opens from the rule ID button in each row (so the keyboard can reach it) and from a click anywhere else on a row or card. It shows severity, state, rule ID, location, the full message, the fingerprint with a copy button, and links to the first and last scan that saw the finding. If a refresh removes the finding that is open, the drawer closes.
- Task 21: "Export CSV" saves every finding that matches the current filters, in the order shown (not only the page on screen), generated in the browser. The file starts with a byte order mark so Excel reads accents correctly, and uses CRLF line endings.
- Task 21: CSV safety: besides quoting commas, quotes and line breaks, any cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'`. Finding text comes from scanned code and attacked apps, and a spreadsheet would otherwise run it as a formula. The cost is that such a cell shows an extra apostrophe.
- Task 20: the project page keeps everything in the address: `projectId`, `scanType` (which findings tab, as the "View findings" link from Task 17 expects), `tab=history`, `severity` (comma list), `state` (open is the default and leaves no trace), `q`, `sort` and `page`. Any filter or sort change goes back to page 1, and switching tab drops the other tab's settings.
- Task 20: the severity counts at the top are also the severity filter: press one or more to show only those. The numbers follow the state and search filters (but not the severity choice), so each says how many you would get by pressing it.
- Task 20: search is a plain, case-insensitive text match on rule ID, location and message (no pattern syntax, so characters like `*` and `(` are just text), and waits 300 ms after the last key before it rewrites the address.
- Task 20: sorting is high severity first by default, then by location (numbers sort naturally, so `a.py:2` comes before `a.py:10`), with a fixed tie-break so rows never shuffle. Other orders: low first, location, rule ID.
- Task 20: paging is on the client, 50 per page, and a page number that is too big shows the last page.
- Task 20: the Scan history tab reuses the scans list from Task 18 (now with an option to hide its project picker). The mock project `many-findings` returns 120 made-up findings so paging and "Show more" can be tried by hand.
- Task 20: clicking a row does nothing yet. The details drawer is Task 21.
- Task 19: the projects page has no "all projects" list to show, because the API has none. It offers an input to open any project by ID, plus the recent projects of this tab with a search box and links to each project and its scans. A project opened from here is added to the recent list.
- Task 19: a test caught a screen reader bug: "View scans" followed by hidden "for demo-app" was read as "View scansfor demo-app" because the space was lost. The space is now explicit.
- Task 18: the scans page keeps its settings in the address (`projectId`, `scanType`, `status`, `sort`), so a link or a reload brings back the same view. The project param is `projectId` like the other pages.
- Task 18: filters and sorting work on the scans loaded so far, because the API only offers a limit and a cursor. When nothing loaded matches and there is another page, the page says to load more.
- Task 18: a project is added to the recent list only once it has at least one scan, so a typo isn't remembered.
- Task 18: the table is a real `<table>` on wide screens and a separate list of cards on phones (two layouts, not one table bent with CSS, which can break screen reader table support). A click anywhere on a row opens the scan, and the link in the first cell does the same for keyboard users.
- Task 18: auto-refresh is every 15 seconds, only while a scan you can see is unfinished, and not while the tab is hidden. `useProjectScans` now takes `autoRefreshWhile` instead of a fixed interval.
- Task 17: "View findings" links to `/projects/detail/?projectId=<id>&scanType=SAST|DAST`. **Task 20's project page must read `scanType` from the link** to open the matching findings tab.
- Task 17: "Start the same scan again" links to `/scans/new/?type=…&project=…&target=…` (target only for app scans). It can't pre-fill the zip file, so a code scan shows "You will need to choose your .zip file again."
- Task 17: the failed-scan box says what happened in plain words for the four failures in section 4.9 and a general sentence for anything else, and always shows the scanner's own message underneath.
- Task 17: the "taking longer than usual" warning counts from when the scan was queued (10 minutes) or started running (25 minutes), not from when it was created. It is a soft warning only: the page never gives up, because the backend fails a stuck scan by itself.
- Task 17: New HIGH is red when above 0, and also says "Needs attention", so colour is not the only signal.
- Task 17: mock project `stuck-demo` now pretends it was queued 26 minutes ago, so the slow-scan warning shows straight away instead of after a 25-minute wait. This changed approved Task 6 mock code.
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

The same list is in the README, with the reasons.

1. An "all scans" call, for example `GET /scans?limit=&cursor=`, so the dashboard is complete instead of built from recent projects.
2. Confirm `imageTag` can be `null` or missing on a scan that has not started.
3. Confirm `upload.expiresIn` is in seconds, counted from when `POST /scans` answers.
4. Findings have no paging: tell us if a project can have thousands.
5. The default and maximum `limit` for scan history (the site sends 20).
6. Enforce the 50 MB limit, and check that the upload really is a zip, on the backend too.
7. What `POST /scans/{id}/start` answers for a scan that was already started (the fake backend answers 409).
8. Scan history and findings of an unknown project should be an empty list, not a 404.
9. Terraform writes `config.json` with `Cache-Control: no-cache`.
10. CORS on API Gateway (GET, POST, OPTIONS; Authorization and Content-Type) and on the upload bucket (PUT; content-type).
