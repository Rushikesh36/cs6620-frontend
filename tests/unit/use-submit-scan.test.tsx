import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useSubmitScan, type SubmitInput } from '@/hooks/use-submit-scan';
import { ApiError } from '@/lib/api/client';
import { UploadError } from '@/lib/api/upload';
import { readRecentProjects } from '@/lib/projects/recent-projects';
import { createWrapper } from './support/query-wrapper';

const { api, upload, push } = vi.hoisted(() => ({
  api: { createScan: vi.fn(), startScan: vi.fn() },
  upload: vi.fn(),
  push: vi.fn(),
}));
vi.mock('@/hooks/use-api', () => ({ useApi: () => api }));
vi.mock('@/lib/api/upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/upload')>()),
  uploadFile: upload,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const uploadInfo = {
  url: 'https://s3.test/uploads/j1?sig=1',
  method: 'PUT' as const,
  headers: { 'Content-Type': 'application/zip' },
  expiresIn: 900,
};
const zip = new File(['x'], 'code.zip', { type: 'application/zip' });
const sast: SubmitInput = { scanType: 'SAST', projectId: 'my-app', targetId: null, file: zip };
const dast: SubmitInput = {
  scanType: 'DAST',
  projectId: 'my-app',
  targetId: 'juice-shop',
  file: null,
};

function setup(input: SubmitInput) {
  const { Wrapper } = createWrapper();
  return renderHook(() => useSubmitScan(input), { wrapper: Wrapper });
}
const phase = (result: { current: ReturnType<typeof useSubmitScan> }) =>
  result.current.status.phase;

beforeEach(() => {
  for (const fn of [api.createScan, api.startScan, upload, push]) fn.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  sessionStorage.clear();
  api.createScan.mockResolvedValue({ jobId: 'j1', status: 'CREATED', upload: uploadInfo });
  api.startScan.mockResolvedValue({ jobId: 'j1', status: 'QUEUED' });
  upload.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('useSubmitScan: happy paths', () => {
  it('code scan: creates the job, uploads, queues it, then opens the scan page', async () => {
    const order: string[] = [];
    api.createScan.mockImplementation(async () => {
      order.push('create');
      return { jobId: 'j1', status: 'CREATED', upload: uploadInfo };
    });
    upload.mockImplementation(async () => void order.push('upload'));
    api.startScan.mockImplementation(async () => {
      order.push('start');
      return { jobId: 'j1', status: 'QUEUED' };
    });
    const { result } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('done'));

    expect(order).toEqual(['create', 'upload', 'start']);
    expect(api.createScan).toHaveBeenCalledWith({ projectId: 'my-app', scanType: 'SAST' });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ upload: uploadInfo, file: zip }));
    expect(api.startScan).toHaveBeenCalledWith('j1');
    expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=j1');
    expect(toast.success).toHaveBeenCalledWith('Scan started');
    expect(readRecentProjects()).toEqual(['my-app']);
  });

  it('app scan: no upload, just create and queue', async () => {
    api.createScan.mockResolvedValue({ jobId: 'j2', status: 'CREATED' });
    api.startScan.mockResolvedValue({ jobId: 'j2', status: 'QUEUED' });
    const { result } = setup(dast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('done'));

    expect(api.createScan).toHaveBeenCalledWith({
      projectId: 'my-app',
      scanType: 'DAST',
      targetId: 'juice-shop',
    });
    expect(upload).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=j2');
  });

  it('shows upload progress while the file is going up', async () => {
    let finish: () => void = () => {};
    upload.mockImplementation(({ onProgress }: { onProgress: (n: number) => void }) => {
      onProgress(0.45);
      return new Promise<void>((resolve) => (finish = resolve));
    });
    const { result } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.progress).toBe(0.45));
    expect(result.current.status).toEqual({ phase: 'running', stage: 'upload' });
    expect(result.current.isBusy).toBe(true);

    await act(async () => finish());
    await waitFor(() => expect(phase(result)).toBe('done'));
  });
});

describe('useSubmitScan: protection against mistakes', () => {
  it('a double click creates only one job', async () => {
    const { result } = setup(sast);

    act(() => {
      result.current.submit();
      result.current.submit();
    });
    await waitFor(() => expect(phase(result)).toBe('done'));

    expect(api.createScan).toHaveBeenCalledTimes(1);
    expect(api.startScan).toHaveBeenCalledTimes(1);
  });

  it('warns before the tab is closed while it is working, and not otherwise', async () => {
    let finish: () => void = () => {};
    upload.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = setup(sast);
    const tryToLeave = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(tryToLeave()).toBe(false);

    act(() => result.current.submit());
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(tryToLeave()).toBe(true);

    await act(async () => finish());
    await waitFor(() => expect(phase(result)).toBe('done'));
  });

  it('cancels the upload and does nothing more if the user leaves the page', async () => {
    let signal: AbortSignal | undefined;
    upload.mockImplementation(({ signal: s }: { signal: AbortSignal }) => {
      signal = s;
      return new Promise<void>((_resolve, reject) =>
        s.addEventListener('abort', () => reject(new UploadError('aborted', 0, 'cancelled'))),
      );
    });
    const { result, unmount } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(upload).toHaveBeenCalled());
    unmount();

    expect(signal?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.startScan).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('useSubmitScan: failures and retry', () => {
  it('creating the job fails: shows the server message, and retry tries creating again', async () => {
    api.createScan.mockRejectedValueOnce(new ApiError(400, 'projectId is invalid'));
    const { result } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('failed'));
    expect(result.current.status).toMatchObject({
      stage: 'create',
      message: 'projectId is invalid',
    });
    expect(upload).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await waitFor(() => expect(phase(result)).toBe('done'));
    expect(api.createScan).toHaveBeenCalledTimes(2);
  });

  it('the upload fails: retry uploads again to the SAME job, without creating a new one', async () => {
    upload.mockRejectedValueOnce(new UploadError('network', 0, 'dropped'));
    const { result } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('failed'));
    expect(result.current.status).toMatchObject({
      stage: 'upload',
      uploadExpired: false,
      message: 'The upload was interrupted. Check your connection and try again.',
    });
    expect(toast.error).toHaveBeenCalledWith('Upload failed');

    act(() => result.current.retry());
    await waitFor(() => expect(phase(result)).toBe('done'));

    expect(api.createScan).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(api.startScan).toHaveBeenCalledTimes(1);
    expect(api.startScan).toHaveBeenCalledWith('j1');
    expect(result.current.notice).toBeNull();
  });

  it('the upload link has expired: retry starts over with a NEW job and says why', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.parse('2026-03-01T12:00:00Z');
    vi.setSystemTime(start);
    api.createScan
      .mockResolvedValueOnce({ jobId: 'j1', status: 'CREATED', upload: uploadInfo })
      .mockResolvedValueOnce({ jobId: 'j2', status: 'CREATED', upload: uploadInfo });
    api.startScan.mockResolvedValue({ jobId: 'j2', status: 'QUEUED' });
    upload.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 901_000); // 15 minutes pass during a slow, failing upload
      throw new UploadError('http', 403, 'forbidden');
    });
    const { result } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('failed'));
    expect(result.current.status).toMatchObject({ stage: 'upload', uploadExpired: true });

    act(() => result.current.retry());
    await waitFor(() => expect(phase(result)).toBe('done'));

    expect(api.createScan).toHaveBeenCalledTimes(2);
    expect(api.startScan).toHaveBeenCalledWith('j2');
    expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=j2');
    expect(result.current.notice).toMatch(/upload link expired/);
  });

  it('queuing fails: retry only queues again, and does not upload a second time', async () => {
    api.startScan.mockRejectedValueOnce(new ApiError(500, 'Queue is down.'));
    const { result } = setup(sast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('failed'));
    expect(result.current.status).toMatchObject({ stage: 'start', message: 'Queue is down.' });

    act(() => result.current.retry());
    await waitFor(() => expect(phase(result)).toBe('done'));

    expect(api.createScan).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(api.startScan).toHaveBeenCalledTimes(2);
  });

  it('uses a plain message for unexpected errors', async () => {
    api.createScan.mockRejectedValueOnce(new Error('TypeError: x is undefined'));
    const { result } = setup(dast);

    act(() => result.current.submit());
    await waitFor(() => expect(phase(result)).toBe('failed'));

    expect(result.current.status).toMatchObject({
      message: 'Something went wrong. Please try again.',
    });
  });
});
