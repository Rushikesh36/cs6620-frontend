// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs the real scripts/site-files.mjs against temporary folders, so nothing in the repo changes.

const repo = path.resolve(import.meta.dirname, '../..');
let work: string;
let publicDir: string;
let outDir: string;

function run(step: string, env: Record<string, string> = {}) {
  const result = spawnSync('node', ['scripts/site-files.mjs', step], {
    cwd: repo,
    encoding: 'utf8',
    // A clean environment: the real VERCEL variables must not leak into these tests.
    env: {
      NODE_ENV: 'test',
      PATH: process.env.PATH ?? '',
      PUBLIC_DIR: publicDir,
      OUT_DIR: outDir,
      ...env,
    },
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

const configFile = () => path.join(publicDir, 'config.json');
const readConfig = () => JSON.parse(readFileSync(configFile(), 'utf8')) as unknown;

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), 'site-files-'));
  publicDir = path.join(work, 'public');
  outDir = path.join(work, 'out');
  mkdirSync(publicDir);
  mkdirSync(outDir);
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe('write-config', () => {
  it('writes config.json from API_BASE_URL and APP_ENVIRONMENT', () => {
    const { code } = run('write-config', {
      VERCEL: '1',
      API_BASE_URL: 'https://abc123.execute-api.us-east-1.amazonaws.com',
      APP_ENVIRONMENT: 'team-6',
    });

    expect(code).toBe(0);
    expect(readConfig()).toEqual({
      apiBaseUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com',
      environment: 'team-6',
    });
  });

  it('drops trailing slashes and falls back to VERCEL_ENV for the environment name', () => {
    run('write-config', {
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      API_BASE_URL: ' https://api.example.com/// ',
    });

    expect(readConfig()).toEqual({ apiBaseUrl: 'https://api.example.com', environment: 'preview' });
  });

  it('fails the build on Vercel when API_BASE_URL is missing, and writes nothing', () => {
    const { code, output } = run('write-config', { VERCEL: '1' });

    expect(code).toBe(1);
    expect(output).toMatch(/API_BASE_URL is not set/);
    expect(existsSync(configFile())).toBe(false);
  });

  it.each([
    ['not a url', /not a full URL/],
    ['ftp://api.example.com', /must start with https:\/\/ or http:\/\//],
    ['http://api.example.com', /must start with https:\/\/ because/],
  ])('fails on Vercel for API_BASE_URL "%s"', (value, message) => {
    const { code, output } = run('write-config', { VERCEL: '1', API_BASE_URL: value });

    expect(code).toBe(1);
    expect(output).toMatch(message);
    expect(existsSync(configFile())).toBe(false);
  });

  it('leaves your own public/config.json alone when API_BASE_URL is not set locally', () => {
    writeFileSync(configFile(), '{"mine":true}');

    const { code } = run('write-config');

    expect(code).toBe(0);
    expect(readFileSync(configFile(), 'utf8')).toBe('{"mine":true}');
  });

  it('allows an http:// API outside Vercel (for example a local server)', () => {
    const { code } = run('write-config', { API_BASE_URL: 'http://localhost:3001' });

    expect(code).toBe(0);
    expect(readConfig()).toEqual({ apiBaseUrl: 'http://localhost:3001', environment: 'local' });
  });
});

describe('strip-dev-files', () => {
  beforeEach(() => {
    for (const name of [
      'mockServiceWorker.js',
      'config.example.json',
      'config.json',
      'index.html',
    ]) {
      writeFileSync(path.join(outDir, name), 'x');
    }
  });

  it('removes the development files and keeps everything else', () => {
    const { code } = run('strip-dev-files');

    expect(code).toBe(0);
    expect(existsSync(path.join(outDir, 'mockServiceWorker.js'))).toBe(false);
    expect(existsSync(path.join(outDir, 'config.example.json'))).toBe(false);
    expect(existsSync(path.join(outDir, 'config.json'))).toBe(true);
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(true);
  });

  it('keeps the service worker in a build that uses the fake backend', () => {
    run('strip-dev-files', { NEXT_PUBLIC_USE_MOCKS: 'true' });

    expect(existsSync(path.join(outDir, 'mockServiceWorker.js'))).toBe(true);
  });

  it('does not mind when the files are already gone', () => {
    rmSync(path.join(outDir, 'mockServiceWorker.js'));

    expect(run('strip-dev-files').code).toBe(0);
  });
});

describe('usage', () => {
  it('rejects an unknown step', () => {
    const { code, output } = run('nonsense');

    expect(code).toBe(1);
    expect(output).toMatch(/Usage/);
  });
});
