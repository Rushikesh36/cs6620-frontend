'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import type { CreateScanRequest, ScanType, UploadInfo } from '@/lib/api/schemas';
import { UploadError, uploadFile } from '@/lib/api/upload';
import { addRecentProject } from '@/lib/projects/recent-projects';
import { useBeforeUnloadWarning } from './use-before-unload';
import { useCreateScan } from './use-create-scan';
import { useStartScan } from './use-start-scan';

export type SubmitStage = 'create' | 'upload' | 'start';

export type SubmitStatus =
  | { phase: 'idle' }
  | { phase: 'running'; stage: SubmitStage }
  | { phase: 'failed'; stage: SubmitStage; message: string; uploadExpired: boolean }
  | { phase: 'done'; jobId: string };

export type SubmitInput = {
  scanType: ScanType;
  projectId: string;
  targetId: string | null;
  file: File | null;
};

type Job = {
  jobId: string;
  upload: UploadInfo | null;
  /** When the pre-signed upload URL stops working, in ms since 1970. */
  uploadDeadline: number | null;
  uploaded: boolean;
};

// Treat the link as expired a little early, so we don't start an upload that can't finish.
const EXPIRY_MARGIN_MS = 5000;

const EXPIRED_NOTICE =
  'The upload link expired, so we created a new scan and are uploading your file again.';

function messageFor(stage: SubmitStage, error: unknown): string {
  if (stage === 'upload' && error instanceof UploadError) {
    if (error.kind === 'network')
      return 'The upload was interrupted. Check your connection and try again.';
    if (error.kind === 'timeout')
      return 'The upload took too long. Try again, or use a smaller .zip.';
    if (error.kind === 'http' && error.status === 403) {
      return 'The upload was refused. The upload link may have expired.';
    }
    return error.message;
  }
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Runs "Start scan": create the job, upload the zip (code scans only), queue the job, then go
 * to the scan page. If a step fails, `retry` carries on from that step, and never makes a
 * second job unless the upload link has expired.
 */
export function useSubmitScan(input: SubmitInput) {
  const router = useRouter();
  const createScan = useCreateScan();
  const startScan = useStartScan();

  const [status, setStatus] = useState<SubmitStatus>({ phase: 'idle' });
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef(input);
  const job = useRef<Job | null>(null);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    inputRef.current = input;
  });

  // Leaving the page would cancel the upload, so don't leave by accident.
  useBeforeUnloadWarning(status.phase === 'running');

  // If the user navigates away inside the app, cancel the upload and stop. Otherwise the flow
  // would carry on in the background and suddenly pull them back to the scan page.
  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async () => {
    // One run at a time: this is what stops a double click from creating two jobs.
    if (running.current) return;
    running.current = true;
    const abort = new AbortController();
    controller.current = abort;
    let stage: SubmitStage = 'create';

    try {
      const { scanType, projectId, targetId, file } = inputRef.current;

      if (!job.current) {
        stage = 'create';
        setStatus({ phase: 'running', stage });
        const request: CreateScanRequest =
          scanType === 'SAST'
            ? { projectId, scanType }
            : { projectId, scanType, targetId: targetId ?? '' };
        const created = await createScan.mutateAsync(request);
        addRecentProject(projectId);
        job.current = {
          jobId: created.jobId,
          upload: created.upload ?? null,
          uploadDeadline: created.upload ? Date.now() + created.upload.expiresIn * 1000 : null,
          uploaded: false,
        };
      }
      const current = job.current;

      if (scanType === 'SAST' && !current.uploaded) {
        stage = 'upload';
        if (!current.upload || !file) throw new Error('Nothing to upload');
        setProgress(0);
        setStatus({ phase: 'running', stage });
        await uploadFile({
          upload: current.upload,
          file,
          onProgress: (fraction) => {
            if (!abort.signal.aborted) setProgress(fraction);
          },
          signal: abort.signal,
        });
        current.uploaded = true;
      }

      stage = 'start';
      setStatus({ phase: 'running', stage });
      await startScan.mutateAsync({ jobId: current.jobId, projectId });

      if (abort.signal.aborted) return;
      setStatus({ phase: 'done', jobId: current.jobId });
      toast.success('Scan started');
      router.push(`/scans/detail/?jobId=${encodeURIComponent(current.jobId)}`);
    } catch (error) {
      if (abort.signal.aborted) return; // the user left; nothing to show
      const expired =
        stage === 'upload' &&
        job.current?.uploadDeadline != null &&
        Date.now() >= job.current.uploadDeadline - EXPIRY_MARGIN_MS;
      if (stage === 'upload') toast.error('Upload failed');
      setStatus({
        phase: 'failed',
        stage,
        message: messageFor(stage, error),
        uploadExpired: expired,
      });
    } finally {
      running.current = false;
    }
  }, [createScan, startScan, router]);

  const submit = useCallback(() => {
    setNotice(null);
    void run();
  }, [run]);

  const retry = useCallback(() => {
    const current = job.current;
    const expired =
      current?.uploadDeadline != null &&
      !current.uploaded &&
      Date.now() >= current.uploadDeadline - EXPIRY_MARGIN_MS;
    if (expired) {
      // The old URL no longer works, so the only way forward is a fresh job.
      job.current = null;
      setNotice(EXPIRED_NOTICE);
    } else {
      setNotice(null);
    }
    void run();
  }, [run]);

  return {
    status,
    progress,
    notice,
    isBusy: status.phase === 'running' || status.phase === 'done',
    submit,
    retry,
  };
}
