import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UploadError, uploadFile } from '@/lib/api/upload';
import { MockBackend } from '@/mocks/backend';
import { createHandlers } from '@/mocks/handlers';

// Runs the real XMLHttpRequest code (jsdom's) against the mock S3, so the headers and the
// "no Authorization" rule are checked end to end and not only against a hand-made fake.
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let clock = Date.parse('2026-03-01T12:00:00Z');

function newSastJob() {
  const backend = new MockBackend({ now: () => clock, random: () => 0.99 });
  server.use(...createHandlers('https://api.test', backend));
  const created = backend.createScan(
    { projectId: 'my-app', scanType: 'SAST' },
    { username: 'demo', role: 'user' },
  );
  if (!created.ok || !created.value.upload) throw new Error('could not create a job');
  return { backend, jobId: created.value.jobId, upload: created.value.upload };
}

describe('uploadFile against the mock S3', () => {
  it('uploads with the headers from the pre-signed URL, and the mock then lets the job start', async () => {
    const { backend, jobId, upload } = newSastJob();
    const progress: number[] = [];

    await uploadFile({
      upload,
      file: new Blob(['zip bytes'], { type: 'application/zip' }),
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(progress.at(-1)).toBe(1);
    expect(backend.startScan(jobId)).toEqual({ ok: true, value: { jobId, status: 'QUEUED' } });
  });

  it('is refused (403) once the upload link has expired', async () => {
    const { upload } = newSastJob();
    clock += 901_000;

    const error = await uploadFile({
      upload,
      file: new Blob(['zip bytes']),
      onProgress: () => {},
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UploadError);
    expect(error).toMatchObject({ kind: 'http', status: 403 });
    clock = Date.parse('2026-03-01T12:00:00Z');
  });

  it('is refused when the headers do not match what the URL was signed with', async () => {
    const { upload } = newSastJob();

    const error = await uploadFile({
      upload: { ...upload, headers: { 'Content-Type': 'text/plain' } },
      file: new Blob(['zip bytes']),
      onProgress: () => {},
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: 'http', status: 403 });
  });
});
