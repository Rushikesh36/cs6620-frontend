import type { UploadInfo } from './schemas';

const UPLOAD_TIMEOUT_MS = 10 * 60_000;

export type UploadErrorKind = 'network' | 'timeout' | 'http' | 'aborted';

export class UploadError extends Error {
  readonly kind: UploadErrorKind;
  /** HTTP status when `kind` is "http", otherwise 0. */
  readonly status: number;

  constructor(kind: UploadErrorKind, status: number, message: string) {
    super(message);
    this.name = 'UploadError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Sends the zip straight to S3 with the pre-signed URL from `POST /scans`.
 *
 * Why this is not the normal API client:
 * - It sends exactly the headers in `upload.headers` and NOTHING else. In particular, no
 *   Authorization header. The URL already carries its own signature, and S3 rejects a request
 *   with an extra signed header it wasn't told about.
 * - It uses XMLHttpRequest instead of fetch because only XHR reports upload progress.
 */
export function uploadFile(options: {
  upload: UploadInfo;
  file: Blob;
  /** Called with a number from 0 to 1. */
  onProgress: (fraction: number) => void;
  /** Aborting this cancels the upload. */
  signal?: AbortSignal;
}): Promise<void> {
  const { upload, file, onProgress, signal } = options;

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError('aborted', 0, 'The upload was cancelled.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(1, event.loaded / event.total));
      }
    };
    xhr.onload = () => {
      // S3 answers 200 when the file is stored.
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new UploadError('http', xhr.status, `The upload server answered ${xhr.status}.`));
      }
    };
    xhr.onerror = () =>
      reject(new UploadError('network', 0, 'The connection was interrupted during the upload.'));
    xhr.ontimeout = () => reject(new UploadError('timeout', 0, 'The upload took too long.'));
    xhr.onabort = () => reject(new UploadError('aborted', 0, 'The upload was cancelled.'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
