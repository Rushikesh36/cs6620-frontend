// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs the real scripts/deploy.sh with a fake `aws` and a fake `npm`, which only write down what
// they were asked to do. So these tests show exactly what a deploy would send to S3.

const repo = path.resolve(import.meta.dirname, '../..');
let work: string;
let bin: string;
let out: string;
let log: string;

function fakeCommand(name: string, body: string) {
  const file = path.join(bin, name);
  writeFileSync(file, `#!/bin/bash\n${body}\n`);
  chmodSync(file, 0o755);
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync('bash', ['scripts/deploy.sh', ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { NODE_ENV: 'test', PATH: `${bin}:/usr/bin:/bin`, OUT_DIR: out, AWS_LOG: log, ...env },
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}
const calls = () =>
  readFileSync(log, 'utf8').trim() ? readFileSync(log, 'utf8').trim().split('\n') : [];
const awsCalls = () => calls().filter((line) => line.startsWith('aws '));

function writeBuild(staticContent = 'console.log("app")') {
  mkdirSync(path.join(out, '_next/static/chunks'), { recursive: true });
  writeFileSync(path.join(out, 'index.html'), '<html></html>');
  writeFileSync(path.join(out, '_next/static/chunks/app.js'), staticContent);
}

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), 'deploy-test-'));
  bin = path.join(work, 'bin');
  out = path.join(work, 'out');
  log = path.join(work, 'calls.log');
  mkdirSync(bin);
  writeFileSync(log, '');
  // The fake aws: write the call down. head-object says the file exists unless told otherwise.
  fakeCommand(
    'aws',
    `echo "aws $*" >> "$AWS_LOG"
if [ "$1 $2" = "s3api head-object" ] && [ "\${FAKE_NO_CONFIG:-0}" = "1" ]; then exit 254; fi`,
  );
  fakeCommand('npm', `echo "npm $*" >> "$AWS_LOG"`);
  writeBuild();
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe('deploy.sh: checking the request', () => {
  it('needs a bucket name, and explains how to use it', () => {
    const { code, output } = run([]);
    expect(code).toBe(1);
    expect(output).toContain('Usage: scripts/deploy.sh <bucket-name>');
    expect(output).toContain('Give the bucket name.');
    expect(awsCalls()).toEqual([]);
  });

  it.each(['UPPER-case', 'ab', 'has space', 'ends-with-hyphen-', 'a/b', 'x'.repeat(64)])(
    'refuses "%s" as a bucket name, and talks to nobody',
    (name) => {
      const { code, output } = run([name, '--skip-build']);
      expect(code).toBe(1);
      expect(output).toContain('is not a valid S3 bucket name');
      expect(awsCalls()).toEqual([]);
    },
  );

  it('reads a name that starts with a hyphen as an option, and refuses it', () => {
    const { code, output } = run(['-starts-with-hyphen', '--skip-build']);
    expect(code).toBe(1);
    expect(output).toContain('Unknown option: -starts-with-hyphen');
    expect(awsCalls()).toEqual([]);
  });

  it('accepts ordinary bucket names, with dots and digits', () => {
    for (const name of ['my-lab-frontend', 'team6.frontend.2026', 'abc']) {
      expect(run([name, '--skip-build']).code).toBe(0);
    }
  });

  it('refuses an unknown option and a second bucket name', () => {
    expect(run(['my-bucket', '--force']).output).toContain('Unknown option: --force');
    expect(run(['my-bucket', 'other-bucket']).output).toContain('Give one bucket name only.');
  });

  it('says what to install when the AWS CLI is missing', () => {
    // A PATH with the tools the script needs, but no aws.
    const tools = path.join(work, 'tools');
    mkdirSync(tools);
    for (const tool of ['dirname', 'grep', 'cat']) {
      const found = spawnSync('which', [tool], { encoding: 'utf8' }).stdout.trim();
      symlinkSync(found, path.join(tools, tool));
    }
    const result = spawnSync('/bin/bash', ['scripts/deploy.sh', 'my-bucket', '--skip-build'], {
      cwd: repo,
      encoding: 'utf8',
      env: { NODE_ENV: 'test', PATH: tools, OUT_DIR: out },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The AWS CLI is not installed');
  });
});

describe('deploy.sh: what it uploads', () => {
  it('uploads the hashed files first, for a year, and then everything else, never cached', () => {
    const { code } = run(['my-bucket', '--skip-build']);
    expect(code).toBe(0);
    const [first, second] = awsCalls();

    expect(first).toBe(
      `aws s3 sync ${out}/_next/static s3://my-bucket/_next/static --delete --cache-control public, max-age=31536000, immutable`,
    );
    expect(second).toContain(`aws s3 sync ${out} s3://my-bucket --delete --cache-control no-cache`);
  });

  it('never uploads or deletes config.json, because Terraform owns it', () => {
    run(['my-bucket', '--skip-build']);
    const second = awsCalls()[1] ?? '';
    expect(second).toContain('--exclude config.json');
    expect(second).not.toMatch(/--include/);
  });

  it('keeps development files off the bucket, and does not repeat the hashed files', () => {
    run(['my-bucket', '--skip-build']);
    const second = awsCalls()[1] ?? '';
    expect(second).toContain('--exclude mockServiceWorker.js');
    expect(second).toContain('--exclude config.example.json');
    expect(second).toContain('--exclude _next/static/*');
  });

  it('sets no-cache on config.json when it is already in the bucket, keeping its type', () => {
    run(['my-bucket', '--skip-build']);
    expect(awsCalls()).toContain('aws s3api head-object --bucket my-bucket --key config.json');
    expect(awsCalls().at(-1)).toBe(
      'aws s3 cp s3://my-bucket/config.json s3://my-bucket/config.json --metadata-directive REPLACE --cache-control no-cache --content-type application/json',
    );
  });

  it('only warns when config.json is not in the bucket yet', () => {
    const { code, output } = run(['my-bucket', '--skip-build'], { FAKE_NO_CONFIG: '1' });
    expect(code).toBe(0);
    expect(awsCalls().some((line) => line.startsWith('aws s3 cp'))).toBe(false);
    expect(output).toContain('config.json does not exist yet');
  });

  it('on a dry run, asks AWS to change nothing and does not touch config.json', () => {
    const { code, output } = run(['my-bucket', '--skip-build', '--dry-run']);
    expect(code).toBe(0);
    const syncs = awsCalls().filter((line) => line.startsWith('aws s3 sync'));
    expect(syncs).toHaveLength(2);
    expect(syncs.every((line) => line.endsWith('--dryrun'))).toBe(true);
    expect(awsCalls().some((line) => line.startsWith('aws s3 cp'))).toBe(false);
    expect(output).toContain('Dry run: nothing will be changed.');
  });
});

describe('deploy.sh: building', () => {
  it('builds first, unless told not to', () => {
    run(['my-bucket']);
    expect(calls()[0]).toBe('npm run build');
    expect(calls()[1]).toMatch(/^aws s3 sync/);

    writeFileSync(log, '');
    run(['my-bucket', '--skip-build']);
    expect(calls().some((line) => line.startsWith('npm'))).toBe(false);
  });

  it('stops, and uploads nothing, if the build has no pages', () => {
    rmSync(path.join(out, 'index.html'));
    const { code, output } = run(['my-bucket', '--skip-build']);
    expect(code).toBe(1);
    expect(output).toContain('No build found');
    expect(awsCalls()).toEqual([]);
  });

  it('refuses a build with the mock backend inside, which the end-to-end tests leave in out/', () => {
    writeBuild('fetch("https://mock-upload.s3.amazonaws.com/uploads/x")');
    const { code, output } = run(['my-bucket', '--skip-build']);
    expect(code).toBe(1);
    expect(output).toContain('holds a build with the mock backend inside');
    expect(awsCalls()).toEqual([]);
  });
});
