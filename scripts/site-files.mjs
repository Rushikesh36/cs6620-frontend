// Two small steps around `next build`, for a host that builds the site itself (Vercel).
// npm runs them for you: `prebuild` runs write-config, `postbuild` runs strip-dev-files.
//
//   node scripts/site-files.mjs write-config      before the build
//   node scripts/site-files.mjs strip-dev-files   after the build
//
// write-config
//   The site reads /config.json when it starts (see src/lib/config.ts). On S3, Terraform wrote that
//   file. On Vercel nothing does, so this step writes public/config.json from environment
//   variables (Project Settings > Environment Variables), and Next copies it into out/.
//     API_BASE_URL      the API address. Required on Vercel, and it must be https://
//     APP_ENVIRONMENT   the name shown in the header badge. Defaults to VERCEL_ENV, or "local"
//   Outside Vercel, without API_BASE_URL, public/config.json is left alone, so `npm run build` on
//   your computer keeps using your own file.
//
// strip-dev-files
//   Removes mockServiceWorker.js and config.example.json from out/, which are development files.
//   Builds with the fake backend (NEXT_PUBLIC_USE_MOCKS=true) keep the worker, which they need.
//
// PUBLIC_DIR and OUT_DIR change the folders (the tests use them).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.resolve(root, process.env.PUBLIC_DIR ?? 'public');
const outDir = path.resolve(root, process.env.OUT_DIR ?? 'out');

const say = (message) => process.stdout.write(`${message}\n`);

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function writeConfig() {
  const onVercel = Boolean(process.env.VERCEL);
  const raw = (process.env.API_BASE_URL ?? '').trim();

  if (!raw) {
    if (onVercel) {
      fail(
        'API_BASE_URL is not set. Add it in Vercel (Project Settings > Environment Variables), ' +
          'for example https://abc123.execute-api.us-east-1.amazonaws.com, then redeploy.',
      );
    }
    say('API_BASE_URL is not set: leaving public/config.json as it is.');
    return;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`API_BASE_URL ("${raw}") is not a full URL. Start it with https://.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    fail(`API_BASE_URL ("${raw}") must start with https:// or http://.`);
  }
  if (onVercel && url.protocol !== 'https:') {
    // Vercel serves the site over HTTPS, and browsers block calls from it to a plain http:// API.
    fail(`API_BASE_URL ("${raw}") must start with https:// because the site is served over HTTPS.`);
  }

  const environment =
    (process.env.APP_ENVIRONMENT ?? '').trim() || (process.env.VERCEL_ENV ?? '').trim() || 'local';
  const config = { apiBaseUrl: raw.replace(/\/+$/, ''), environment };

  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(publicDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  say(`Wrote public/config.json (apiBaseUrl ${config.apiBaseUrl}, environment ${environment}).`);
}

function stripDevFiles() {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    say('This build uses the fake backend: keeping mockServiceWorker.js.');
    return;
  }
  for (const name of ['mockServiceWorker.js', 'config.example.json']) {
    rmSync(path.join(outDir, name), { force: true });
  }
  say('Removed development files from out/.');
}

const steps = { 'write-config': writeConfig, 'strip-dev-files': stripDevFiles };
const step = steps[process.argv[2] ?? ''];
if (!step) fail(`Usage: node scripts/site-files.mjs <${Object.keys(steps).join(' | ')}>`);
step();
