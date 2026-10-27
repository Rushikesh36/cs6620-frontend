# Unified Security Hub: frontend

The dashboard for Unified Security Hub (CS6620 Cloud Computing, Northeastern University, Team 6). People log in, start code scans (SAST) and app scans (DAST), watch them run, and review the findings of each project. It is a static website that talks to the team's API; there is no server of its own.

## Contents

- [Run it on your computer](#run-it-on-your-computer)
- [The config.json file](#the-configjson-file)
- [Scripts](#scripts)
- [Deploy to S3](#deploy-to-s3)
- [What the backend must provide](#what-the-backend-must-provide)
- [How it works](#how-it-works)
- [Known limitations](#known-limitations)
- [Backend requests](#backend-requests)
- [Troubleshooting](#troubleshooting)

## Run it on your computer

You need Node 20.9 or newer (`nvm use` picks version 22 from `.nvmrc`) and npm.

```bash
npm install
cp public/config.example.json public/config.json
```

### With the fake backend (no AWS needed)

```bash
npm run dev:mock
```

Open <http://localhost:3000> and log in:

| Username | Password    | Role                              |
| -------- | ----------- | --------------------------------- |
| `demo`   | `demo123`   | `user`                            |
| `ci-bot` | `ci-bot123` | `ci` (shows a "CI account" badge) |

Anything else gets a 401. The fake backend runs in your browser (Mock Service Worker) and behaves like the real one: a scan goes created, queued (5 seconds), running (15 seconds), then completed, and about 1 in 5 fail with a realistic error. Findings change between scans of the same project: some become fixed and a few are new. Your scans survive a page reload and are forgotten when you close the tab. A small "Mock API" badge shows in the corner while it is on.

Special project IDs for trying things out:

| Project ID      | What it does                                                                           |
| --------------- | -------------------------------------------------------------------------------------- |
| `demo-app`      | Starts with a few finished scans and findings, so list pages have something to show    |
| `fail-demo`     | Every scan fails                                                                       |
| `stuck-demo`    | Stays running forever, and already looks 26 minutes old, to show the slow-scan warning |
| `many-findings` | Has 120 findings of each type, to try paging and long messages                         |

Copy `.env.example` to `.env.local` to change how the fake backend behaves (restart the dev server afterwards):

| Setting                          | Effect                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MOCK_TOKEN_MINUTES` | How long a login lasts (default 60). Use `2` to try expiry and the warning banner |
| `NEXT_PUBLIC_MOCK_FAILURE_RATE`  | Share of scans that fail, 0 to 1 (default 0.2)                                    |
| `NEXT_PUBLIC_MOCK_RANDOM_500`    | `true` answers about 1 in 5 API calls with a 500, to see error states             |
| `NEXT_PUBLIC_MOCK_TIME_SCALE`    | `0.1` makes scans ten times faster                                                |
| `NEXT_PUBLIC_MOCK_NO_TARGETS`    | `true` makes the list of test apps empty                                          |

### Against a real lab

Put that lab's API address in `public/config.json` (see below) and run:

```bash
npm run dev
```

The file is ignored by git, because every AWS account has its own.

## The config.json file

One build works in all three AWS accounts, because the site reads its settings when it starts, from `/config.json` at its own root. In production Terraform writes this file into the S3 bucket; on your computer it is `public/config.json`.

```json
{
  "apiBaseUrl": "https://abc123.execute-api.us-east-1.amazonaws.com",
  "environment": "rushikesh-lab"
}
```

- `apiBaseUrl`: the full address of the API, starting with `https://` or `http://`. A trailing slash is removed.
- `environment`: a short name shown as a badge in the header, so people know which lab they are looking at.

If the file is missing or wrong, the site shows a full-page "Configuration error" that says what is wrong and offers "Try again". It is checked with Zod, and never cached.

## Scripts

| Command             | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`       | Development server, talking to the API in `public/config.json`                    |
| `npm run dev:mock`  | Development server with the fake backend                                          |
| `npm run build`     | Builds the static site into `out/`                                                |
| `npm run typecheck` | TypeScript check                                                                  |
| `npm run lint`      | ESLint                                                                            |
| `npm run format`    | Prettier (`format:check` only reports)                                            |
| `npm test`          | Unit and component tests (`test:coverage` adds a coverage table)                  |
| `npm run test:e2e`  | End-to-end tests in a real browser (needs `npx playwright install chromium` once) |
| `scripts/deploy.sh` | Builds and uploads to S3 (below)                                                  |

More about the tests in [tests/README.md](tests/README.md).

## Deploy to S3

```bash
aws sts get-caller-identity              # make sure you are in the right account
scripts/deploy.sh my-lab-frontend --dry-run   # shows what would change
scripts/deploy.sh my-lab-frontend
```

The script builds the site, then uploads `out/` to the bucket:

- `_next/static/` first, with a one-year cache (their names change whenever their content does).
- Everything else second, with `Cache-Control: no-cache`, so browsers check for a new version on every visit.
- `config.json` is **never uploaded or deleted**: Terraform owns it. The script only sets `Cache-Control: no-cache` on it if it exists. Make Terraform set the same header, or the next `terraform apply` removes it.
- `mockServiceWorker.js` and `config.example.json` are development files and are left out.
- It refuses to upload a build that contains the fake backend (`npm run test:e2e` leaves one in `out/`).

`--delete` is on, so files that are no longer part of the site are removed. A tab that was opened before a deploy may need a reload.

### What the bucket needs (for whoever writes the Terraform)

- **Static website hosting** on, with index document `index.html` and error document `404.html`.
- The bucket must be readable by the public (or by whoever uses it), and `config.json` must exist in it.
- The site is served over **HTTP** (the S3 website endpoint has no HTTPS), for example `http://my-lab-frontend.s3-website-us-east-1.amazonaws.com`.

## What the backend must provide

The full details are in the backend requirements page the team shares with the Lambda authors. In short:

**Endpoints used** (everything except `/login` needs `Authorization: Bearer <token>`):

| Method | Path                                         | Used for                                          |
| ------ | -------------------------------------------- | ------------------------------------------------- |
| POST   | `/login`                                     | Log in                                            |
| GET    | `/targets`                                   | The list of test apps for app scans               |
| POST   | `/scans`                                     | Create a scan (code scans get an upload URL back) |
| POST   | `/scans/{jobId}/start`                       | Queue a scan                                      |
| GET    | `/scans/{jobId}`                             | One scan's status (polled every 5 seconds)        |
| GET    | `/projects/{projectId}/scans?limit=&cursor=` | A project's scan history                          |
| GET    | `/projects/{projectId}/findings?scanType=`   | A project's findings                              |

**Rules the frontend relies on:**

- Errors look like `{ "error": "message" }`. 401 means the token is missing or expired (the site logs out), 403 and 404 get their own friendly messages, and 5xx can be retried.
- The login token must be a JWT with a numeric `exp` claim. There is no refresh token.
- Uploads go straight to S3 with an HTTP `PUT` to the pre-signed URL, with exactly the headers the API returned and **no `Authorization` header**.
- A job that is stuck must be marked FAILED by the backend itself.

**CORS** (the site and the API are different origins, so both need rules that allow the site's address, for example `http://my-lab-frontend.s3-website-us-east-1.amazonaws.com`):

- API Gateway: allow methods `GET`, `POST`, `OPTIONS` and headers `Authorization`, `Content-Type`. The browser sends an `OPTIONS` request first because of the `Authorization` header.
- The upload bucket:

```json
[
  {
    "AllowedOrigins": ["http://my-lab-frontend.s3-website-us-east-1.amazonaws.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3000
  }
]
```

## How it works

- **A static site.** Next.js with `output: 'export'`: plain files in `out/`, no server, no server-side code. Pages that need an ID use the address bar (`/scans/detail/?jobId=...`, `/projects/detail/?projectId=...`) because a static site cannot know every ID in advance.
- **Everything is fetched in the browser.** TanStack Query does the caching, retries and polling, and every response is checked with Zod before the app uses it (`src/lib/api/schemas.ts` is the single place that describes the API).
- **Login.** The token and user live in `sessionStorage` (gone when the tab closes), and the session ends at the earlier of the token's own expiry and the `expiresIn` from login. A banner appears 5 minutes before. Logging out also empties the cache.
- **The address bar remembers the view.** Filters, search, sort, page and tab are in the address, so a link or a reload brings back the same view.
- **The fake backend** (`src/mocks/`) sits behind the same schemas and is only compiled in when `NEXT_PUBLIC_USE_MOCKS=true`. A normal build contains none of it.

```
src/
  app/          pages (login, the logged-in group, 404)
  components/   ui (shadcn), layout, scans, findings, projects, dashboard, common
  hooks/        one hook per resource (useScan, useProjectScans, ...)
  lib/          api client and schemas, auth, config, query setup, helpers
  mocks/        the fake backend (development and tests only)
tests/          unit (Vitest) and e2e (Playwright)
scripts/        deploy.sh
```

## Known limitations

- **HTTP-only hosting.** The S3 website endpoint has no HTTPS, so anyone on the same network could change the page on its way to the browser, and with it steal the login token. Use it on trusted networks, or put CloudFront with HTTPS in front if the lab account allows it. The site avoids features that need a secure page: copy buttons fall back to an older method, and it never uses `crypto.randomUUID`.
- **The Content Security Policy is set with `<meta>` tags** (a static site cannot send headers), which has limits: it cannot set `frame-ancestors`, `report-uri` or `sandbox`, and it only covers what loads after the browser reads it, so the first request for `config.json` is not covered. Scripts need `'unsafe-inline'` because a static Next.js page carries its start-up data in inline scripts. Uploads are allowed to `https://*.amazonaws.com`, because the bucket's name is not known in advance. The policy is added in production builds only. It is two tags: a fixed one, and one with the API address that is added once `config.json` has loaded.
- **No refresh tokens.** When the token runs out, people log in again, and anything unsent is lost.
- **Filters and sorting on the scans list work on the scans loaded so far**, because the API only offers a limit and a cursor.
- **The dashboard is built from your recent projects**, because there is no "all scans" endpoint. It sees the latest 20 scans of each project you used in this browser tab.
- **Leaving the page during an upload.** Closing or reloading the tab asks first. Moving to another page inside the site cancels the upload quietly (browsers cannot ask about that).
- **Accessibility** was checked with tests (labels, roles, keyboard use, measured colour contrast against WCAG AA) but not with a real screen reader.

## Backend requests

Things the frontend needs or assumes that are not in the agreed API yet. Please confirm or build them:

1. **An "all scans" call**, for example `GET /scans?limit=&cursor=`, with the same item shape as a single scan. It would make the dashboard complete.
2. **`imageTag`** may be `null` or missing on a scan that has not started. Confirm this is allowed.
3. **`upload.expiresIn`** is in seconds, counted from the moment `POST /scans` answers.
4. **Findings size.** `GET /projects/{id}/findings` has no paging, so the whole list is loaded and paged in the browser. Tell us if a project can have thousands.
5. **Scan history `limit`.** What are the default and the maximum? The site sends 20.
6. **Check uploads on the backend too.** The site blocks files over 50 MB and files that are not `.zip`, but a browser cannot see inside a file, and a pre-signed URL alone cannot limit its size.
7. **Starting twice.** What does `POST /scans/{id}/start` answer for a scan that was already started? The fake backend answers 409.
8. **Unknown projects.** Scan history and findings of a project with no scans should be an empty list, not a 404, because people type project IDs by hand.
9. **Terraform** should write `config.json` and give it `Cache-Control: no-cache`.
10. **CORS** as described above, on API Gateway and on the upload bucket.

## Troubleshooting

- **"Configuration error" on the whole page.** `config.json` is missing or wrong. Locally, copy `public/config.example.json` to `public/config.json`. On S3, check that Terraform wrote it.
- **"Another next dev server is already running".** Stop the other one (`npm run dev` and `npm run dev:mock` cannot run together in one folder).
- **"The mock API could not start".** `public/mockServiceWorker.js` is missing, or the browser blocked service workers. Reload, or run `npx msw init public/`.
- **Logged out straight away.** The mock token lasts `NEXT_PUBLIC_MOCK_TOKEN_MINUTES`. Check `.env.local`.
- **Uploads fail on a real lab.** The upload bucket's CORS rule must allow `PUT` and the `content-type` header from the site's address.
