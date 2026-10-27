import type {
  CreateScanRequest,
  CreateScanResponse,
  Finding,
  LoginResponse,
  Scan,
  ScanListResponse,
  ScanStatus,
  ScanSummary,
  ScanType,
  Target,
  User,
} from '@/lib/api/schemas';
import { BASELINE_COUNT, FINDING_POOLS } from './finding-pool';
import { defaultOptions, type MockOptions } from './options';
import { createToken, readToken } from './token';

export const MOCK_UPLOAD_ORIGIN = 'https://mock-upload.s3.amazonaws.com';
const UPLOAD_EXPIRES_IN_SECONDS = 900;
const QUEUED_MS = 5_000; // from /start until a scanner picks the job up
const RUNNING_MS = 15_000; // time the scanner works
// stuck-demo scans pretend to have been queued this long ago, so the "taking longer than usual"
// warning (shown after 25 minutes of running) can be seen without waiting.
const STUCK_AGE_MS = 26 * 60_000;
const STORAGE_KEY = 'ush-mock-backend-v1';
const PROJECT_ID_RULE = /^[a-z][a-z0-9-]{2,49}$/;

export const PROJECT_ID_MESSAGE =
  'projectId must be 3 to 50 characters: lowercase letters, digits and hyphens, starting with a letter.';

const USERS: Record<string, { password: string; role: User['role'] }> = {
  demo: { password: 'demo123', role: 'user' },
  'ci-bot': { password: 'ci-bot123', role: 'ci' },
};

const TARGETS: Target[] = [
  {
    targetId: 'juice-shop',
    name: 'OWASP Juice Shop',
    description: 'Deliberately vulnerable test app',
  },
];

const FAILURES = [
  { error: 'Scanner exited with code 1', beforeRun: false },
  { error: 'No report produced', beforeRun: false },
  { error: 'Timed out after 25 minutes', beforeRun: false },
  { error: 'Could not start scanner task', beforeRun: true },
];

const IMAGE_TAGS: Record<ScanType, string> = {
  SAST: 'semgrep-1.4.0-abc1234',
  DAST: 'zap-2.15.0-9f3c1d2',
};

type Outcome = 'complete' | 'fail' | 'stuck';

type JobRecord = {
  jobId: string;
  projectId: string;
  scanType: ScanType;
  targetId: string | null;
  requestedBy: string;
  createdAt: number;
  uploadExpiresAt: number | null;
  uploaded: boolean;
  startRequestedAt: number | null;
  outcome: Outcome;
  failure: { error: string; beforeRun: boolean } | null;
  /** Whether this job's findings have been merged into the project's findings yet. */
  applied: boolean;
  summary: ScanSummary | null;
};

type StoredFinding = {
  poolIndex: number;
  fingerprint: string;
  state: Finding['state'];
  firstSeenJobId: string;
  lastSeenJobId: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({
  ok: false,
  status,
  error,
});
const succeed = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** A fake 64-character hex string, shaped like a SHA-256 fingerprint. */
function fakeSha256(input: string): string {
  let out = '';
  for (let round = 0; round < 8; round++) {
    let hash = (0x811c9dc5 + round * 16777619) >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    out += hash.toString(16).padStart(8, '0');
  }
  return out;
}

const keyOf = (projectId: string, scanType: ScanType) => `${projectId}|${scanType}`;

export class MockBackend {
  readonly options: MockOptions;
  private jobs: JobRecord[] = [];
  private findings = new Map<string, StoredFinding[]>();

  constructor(options: Partial<MockOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    if (!this.load()) {
      this.seed();
      this.save();
    }
  }

  // ---- auth ----

  login(username: string, password: string): LoginResponse | null {
    const account = USERS[username];
    if (!account || account.password !== password) return null;
    const user: User = { username, role: account.role };
    const ttl = Math.round(this.options.tokenMinutes * 60);
    return { token: createToken(user, this.options.now(), ttl), expiresIn: ttl, user };
  }

  authenticate(request: Request): User | null {
    const header = request.headers.get('Authorization') ?? '';
    const match = /^Bearer (.+)$/.exec(header);
    return match?.[1] ? readToken(match[1], this.options.now()) : null;
  }

  /** True when this call should fail with a random 500 (only if the flag is on). */
  shouldFailRandomly(): boolean {
    return this.options.random500Rate > 0 && this.options.random() < this.options.random500Rate;
  }

  // ---- targets ----

  targets(): Target[] {
    return this.options.noTargets ? [] : TARGETS;
  }

  // ---- scans ----

  createScan(request: CreateScanRequest, user: User): Result<CreateScanResponse> {
    if (!PROJECT_ID_RULE.test(request.projectId)) return fail(400, PROJECT_ID_MESSAGE);
    if (request.scanType === 'DAST' && !TARGETS.some((t) => t.targetId === request.targetId)) {
      return fail(400, 'Unknown target. Choose one of the registered test apps.');
    }

    const now = this.options.now();
    const failure =
      request.projectId === 'fail-demo' || this.options.random() < this.options.failureRate
        ? (FAILURES[Math.floor(this.options.random() * FAILURES.length)] ?? FAILURES[0] ?? null)
        : null;

    const job: JobRecord = {
      jobId: this.newJobId(),
      projectId: request.projectId,
      scanType: request.scanType,
      targetId: request.scanType === 'DAST' ? request.targetId : null,
      requestedBy: user.username,
      createdAt: request.projectId === 'stuck-demo' ? now - STUCK_AGE_MS - 1000 : now,
      uploadExpiresAt: request.scanType === 'SAST' ? now + UPLOAD_EXPIRES_IN_SECONDS * 1000 : null,
      uploaded: false,
      startRequestedAt: null,
      outcome: request.projectId === 'stuck-demo' ? 'stuck' : failure ? 'fail' : 'complete',
      failure: request.projectId === 'stuck-demo' ? null : failure,
      applied: false,
      summary: null,
    };
    this.jobs.push(job);
    this.save();

    if (request.scanType === 'SAST') {
      return succeed({
        jobId: job.jobId,
        status: 'CREATED',
        upload: {
          url: `${MOCK_UPLOAD_ORIGIN}/uploads/${job.jobId}?X-Amz-Signature=mock`,
          method: 'PUT',
          headers: { 'Content-Type': 'application/zip' },
          expiresIn: UPLOAD_EXPIRES_IN_SECONDS,
        },
      });
    }
    return succeed({ jobId: job.jobId, status: 'CREATED' });
  }

  /** What S3 would answer to the pre-signed PUT. */
  receiveUpload(jobId: string, headers: Headers): Result<null> {
    const job = this.find(jobId);
    if (!job || job.uploadExpiresAt === null) return fail(403, 'AccessDenied');
    // Real S3 rejects the request when a header that was not signed is added.
    if (headers.has('Authorization')) return fail(403, 'SignatureDoesNotMatch');
    if (headers.get('Content-Type') !== 'application/zip')
      return fail(403, 'SignatureDoesNotMatch');
    if (this.options.now() > job.uploadExpiresAt) return fail(403, 'Request has expired');
    job.uploaded = true;
    this.save();
    return succeed(null);
  }

  startScan(jobId: string): Result<{ jobId: string; status: 'QUEUED' }> {
    const job = this.find(jobId);
    if (!job) return fail(404, 'Scan not found');
    if (job.startRequestedAt !== null) return fail(409, 'This scan was already started.');
    if (job.scanType === 'SAST' && !job.uploaded) {
      return fail(400, 'Upload the code as a .zip file before starting the scan.');
    }
    const now = this.options.now();
    job.startRequestedAt = job.outcome === 'stuck' ? now - STUCK_AGE_MS : now;
    this.save();
    return succeed({ jobId: job.jobId, status: 'QUEUED' });
  }

  getScan(jobId: string): Scan | null {
    this.settle();
    const job = this.find(jobId);
    return job ? this.view(job) : null;
  }

  listScans(projectId: string, limit: number, cursor: string | null): Result<ScanListResponse> {
    let offset = 0;
    if (cursor) {
      const parsed = /^o:(\d+)$/.exec(safeAtob(cursor) ?? '');
      if (!parsed?.[1]) return fail(400, 'Invalid cursor.');
      offset = Number(parsed[1]);
    }
    this.settle();
    const all = this.jobs
      .filter((job) => job.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt || this.jobs.indexOf(b) - this.jobs.indexOf(a));
    const page = all.slice(offset, offset + limit);
    const next = offset + limit;
    return succeed({
      items: page.map((job) => this.view(job)),
      nextCursor: next < all.length ? btoa(`o:${next}`) : null,
    });
  }

  getFindings(projectId: string, scanType: ScanType): Finding[] {
    this.settle();
    const pool = FINDING_POOLS[scanType];
    return (this.findings.get(keyOf(projectId, scanType)) ?? []).flatMap((stored) => {
      const entry = pool[stored.poolIndex];
      return entry
        ? [
            {
              fingerprint: stored.fingerprint,
              ruleId: entry.ruleId,
              severity: entry.severity,
              location: entry.location,
              message: entry.message,
              state: stored.state,
              firstSeenJobId: stored.firstSeenJobId,
              lastSeenJobId: stored.lastSeenJobId,
            },
          ]
        : [];
    });
  }

  // ---- internals ----

  private find(jobId: string): JobRecord | undefined {
    return this.jobs.find((job) => job.jobId === jobId);
  }

  private newJobId(): string {
    const random = Math.floor(this.options.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    const serial = this.jobs.length.toString(16).padStart(4, '0');
    return `${random}-${serial}`;
  }

  /** Works out the job's status from the time passed since /start. Nothing is stored. */
  private view(job: JobRecord): Scan {
    const now = this.options.now();
    const queuedMs = QUEUED_MS * this.options.timeScale;
    const runningMs = RUNNING_MS * this.options.timeScale;
    const iso = (ms: number) => new Date(ms).toISOString();

    let status: ScanStatus = 'CREATED';
    let queuedAt: number | null = null;
    let startedAt: number | null = null;
    let finishedAt: number | null = null;

    if (job.startRequestedAt !== null) {
      const elapsed = now - job.startRequestedAt;
      queuedAt = job.startRequestedAt;
      status = 'QUEUED';
      if (elapsed >= queuedMs) {
        if (job.failure?.beforeRun && job.outcome === 'fail') {
          status = 'FAILED';
          finishedAt = job.startRequestedAt + queuedMs;
        } else {
          status = 'RUNNING';
          startedAt = job.startRequestedAt + queuedMs;
          if (job.outcome !== 'stuck' && elapsed >= queuedMs + runningMs) {
            finishedAt = startedAt + runningMs;
            status = job.outcome === 'fail' ? 'FAILED' : 'COMPLETED';
          }
        }
      }
    }

    return {
      jobId: job.jobId,
      projectId: job.projectId,
      scanType: job.scanType,
      targetId: job.targetId,
      status,
      requestedBy: job.requestedBy,
      // Like a real backend might: no image tag until a scanner has been picked.
      imageTag: startedAt === null ? null : IMAGE_TAGS[job.scanType],
      createdAt: iso(job.createdAt),
      queuedAt: queuedAt === null ? null : iso(queuedAt),
      startedAt: startedAt === null ? null : iso(startedAt),
      finishedAt: finishedAt === null ? null : iso(finishedAt),
      summary: status === 'COMPLETED' ? job.summary : null,
      error: status === 'FAILED' ? (job.failure?.error ?? 'Scanner exited with code 1') : null,
    };
  }

  /** Merges the findings of every newly COMPLETED job, oldest first. */
  private settle(): void {
    const ready = this.jobs
      .filter((job) => !job.applied && this.view(job).status === 'COMPLETED')
      .sort((a, b) => (a.startRequestedAt ?? 0) - (b.startRequestedAt ?? 0));
    for (const job of ready) this.applyFindings(job);
    if (ready.length > 0) this.save();
  }

  private applyFindings(job: JobRecord): void {
    const key = keyOf(job.projectId, job.scanType);
    const pool = FINDING_POOLS[job.scanType];
    const previous = this.findings.get(key) ?? [];
    const completedBefore = this.jobs.filter(
      (other) => other.applied && keyOf(other.projectId, other.scanType) === key,
    ).length;

    const stored = previous.map((finding) => ({ ...finding }));
    const makeNew = (poolIndex: number): StoredFinding => {
      const entry = pool[poolIndex];
      return {
        poolIndex,
        fingerprint: fakeSha256(
          `${job.projectId}|${job.scanType}|${entry?.ruleId}|${entry?.location}`,
        ),
        state: 'OPEN',
        firstSeenJobId: job.jobId,
        lastSeenJobId: job.jobId,
      };
    };
    const isHigh = (finding: StoredFinding) => pool[finding.poolIndex]?.severity === 'HIGH';

    let summary: ScanSummary;
    if (completedBefore === 0) {
      const added = Array.from({ length: BASELINE_COUNT[job.scanType] }, (_, i) => makeNew(i));
      stored.push(...added);
      summary = { new: added.length, newHigh: added.filter(isHigh).length, stillOpen: 0, fixed: 0 };
    } else {
      const open = stored.filter((finding) => finding.state === 'OPEN');
      const toFix = open.slice(0, 2);
      for (const finding of toFix) finding.state = 'FIXED';
      for (const finding of open.slice(toFix.length)) finding.lastSeenJobId = job.jobId;

      const used = new Set(stored.map((finding) => finding.poolIndex));
      const addCount = 2 + (completedBefore % 2);
      const added: StoredFinding[] = [];
      for (let i = 0; i < pool.length && added.length < addCount; i++) {
        if (!used.has(i)) added.push(makeNew(i));
      }
      stored.push(...added);
      summary = {
        new: added.length,
        newHigh: added.filter(isHigh).length,
        stillOpen: open.length - toFix.length,
        fixed: toFix.length,
      };
    }

    this.findings.set(key, stored);
    job.summary = summary;
    job.applied = true;
  }

  /** A little history so list pages have something to show on first load. */
  private seed(): void {
    const now = this.options.now();
    const hours = (n: number) => n * 3_600_000;
    const add = (
      scanType: ScanType,
      requestedBy: string,
      ageHours: number,
      failure: JobRecord['failure'] = null,
    ) => {
      const createdAt = now - hours(ageHours);
      this.jobs.push({
        jobId: this.newJobId(),
        projectId: 'demo-app',
        scanType,
        targetId: scanType === 'DAST' ? 'juice-shop' : null,
        requestedBy,
        createdAt,
        uploadExpiresAt: scanType === 'SAST' ? createdAt + UPLOAD_EXPIRES_IN_SECONDS * 1000 : null,
        uploaded: scanType === 'SAST',
        startRequestedAt: createdAt + 4_000,
        outcome: failure ? 'fail' : 'complete',
        failure,
        applied: false,
        summary: null,
      });
    };
    add('SAST', 'demo', 48);
    add('SAST', 'ci-bot', 24);
    add('DAST', 'demo', 22);
    add('SAST', 'demo', 3, { error: 'No report produced', beforeRun: false });
    this.settle();
  }

  // ---- persistence (so a page reload doesn't lose your jobs) ----

  private save(): void {
    if (!this.options.persist) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ jobs: this.jobs, findings: [...this.findings.entries()] }),
      );
    } catch {
      // Storage unavailable: the mock still works, it just forgets on reload.
    }
  }

  private load(): boolean {
    if (!this.options.persist) return false;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as { jobs: JobRecord[]; findings: [string, StoredFinding[]][] };
      this.jobs = data.jobs;
      this.findings = new Map(data.findings);
      return true;
    } catch {
      return false;
    }
  }
}

function safeAtob(value: string): string | null {
  try {
    return atob(value);
  } catch {
    return null;
  }
}
