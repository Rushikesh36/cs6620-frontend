import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadError, uploadFile } from '@/lib/api/upload';
import type { UploadInfo } from '@/lib/api/schemas';

// A stand-in for XMLHttpRequest that lets each test play the part of S3.
class FakeXHR {
  static instances: FakeXHR[] = [];
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = undefined;
  timeout = 0;
  status = 0;
  aborted = false;
  upload: {
    onprogress:
      ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  // test helpers
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ lengthComputable, loaded, total });
  }
  respond(status: number) {
    this.status = status;
    this.onload?.();
  }
}

const info: UploadInfo = {
  url: 'https://bucket.s3.amazonaws.com/uploads/job-1?X-Amz-Signature=abc',
  method: 'PUT',
  headers: { 'Content-Type': 'application/zip' },
  expiresIn: 900,
};
const file = new Blob(['zip bytes'], { type: 'application/zip' });
const latest = () => FakeXHR.instances.at(-1) as FakeXHR;

beforeEach(() => {
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});
afterEach(() => vi.unstubAllGlobals());

describe('uploadFile', () => {
  it('PUTs the file to the pre-signed URL with exactly the headers it was given', async () => {
    const done = uploadFile({ upload: info, file, onProgress: () => {} });
    const xhr = latest();

    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe(info.url);
    expect(xhr.headers).toEqual({ 'Content-Type': 'application/zip' });
    expect(xhr.body).toBe(file);

    xhr.respond(200);
    await expect(done).resolves.toBeUndefined();
  });

  it('never sends an Authorization header: it would break the pre-signed signature', async () => {
    const done = uploadFile({ upload: info, file, onProgress: () => {} });
    latest().respond(200);
    await done;
    expect(Object.keys(latest().headers).map((name) => name.toLowerCase())).not.toContain(
      'authorization',
    );
  });

  it('reports progress as a number from 0 to 1, and 1 when it is stored', async () => {
    const onProgress = vi.fn();
    const done = uploadFile({ upload: info, file, onProgress });

    latest().progress(25, 100);
    latest().progress(50, 100);
    latest().respond(200);
    await done;

    expect(onProgress.mock.calls.map(([value]) => value)).toEqual([0.25, 0.5, 1]);
  });

  it('ignores progress events that have no total, and never goes above 1', async () => {
    const onProgress = vi.fn();
    const done = uploadFile({ upload: info, file, onProgress });

    latest().progress(10, 0, false);
    latest().progress(500, 100);
    latest().respond(200);
    await done;

    expect(onProgress.mock.calls.map(([value]) => value)).toEqual([1, 1]);
  });

  it.each([403, 500])('rejects with the status when S3 answers %i', async (status) => {
    const done = uploadFile({ upload: info, file, onProgress: () => {} });
    latest().respond(status);

    const error = await done.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error).toMatchObject({ kind: 'http', status });
  });

  it('rejects when the connection drops', async () => {
    const done = uploadFile({ upload: info, file, onProgress: () => {} });
    latest().onerror?.();
    await expect(done).rejects.toMatchObject({ kind: 'network' });
  });

  it('rejects when it takes too long', async () => {
    const done = uploadFile({ upload: info, file, onProgress: () => {} });
    expect(latest().timeout).toBeGreaterThan(0);
    latest().ontimeout?.();
    await expect(done).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const done = uploadFile({
      upload: info,
      file,
      onProgress: () => {},
      signal: controller.signal,
    });

    controller.abort();

    expect(latest().aborted).toBe(true);
    await expect(done).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('does not even start when it was already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadFile({ upload: info, file, onProgress: () => {}, signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: 'aborted',
    });
    expect(FakeXHR.instances).toHaveLength(0);
  });
});
