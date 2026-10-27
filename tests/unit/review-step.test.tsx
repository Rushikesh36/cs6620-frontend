import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewStep } from '@/components/scans/new-scan/review-step';
import { ApiError } from '@/lib/api/client';
import { UploadError } from '@/lib/api/upload';
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
vi.mock('@/hooks/use-targets', () => ({
  useTargets: () => ({
    data: [{ targetId: 'juice-shop', name: 'OWASP Juice Shop', description: 'd' }],
  }),
}));

const uploadInfo = {
  url: 'https://s3.test/u?sig=1',
  method: 'PUT' as const,
  headers: { 'Content-Type': 'application/zip' },
  expiresIn: 900,
};
const zip = Object.defineProperty(
  new File(['x'], 'code.zip', { type: 'application/zip' }),
  'size',
  {
    value: 2.5 * 1024 * 1024,
  },
);

function renderReview(props: Partial<Parameters<typeof ReviewStep>[0]> = {}) {
  const { Wrapper } = createWrapper();
  const onBack = vi.fn();
  render(
    <Wrapper>
      <ReviewStep
        scanType="SAST"
        projectId="my-app"
        file={zip}
        targetId={null}
        onBack={onBack}
        {...props}
      />
    </Wrapper>,
  );
  return { onBack };
}

beforeEach(() => {
  for (const fn of [api.createScan, api.startScan, upload, push]) fn.mockReset();
  sessionStorage.clear();
  api.createScan.mockResolvedValue({ jobId: 'j1', status: 'CREATED', upload: uploadInfo });
  api.startScan.mockResolvedValue({ jobId: 'j1', status: 'QUEUED' });
  upload.mockResolvedValue(undefined);
});

describe('ReviewStep summary', () => {
  it('summarises a code scan: type, project, file and its size', () => {
    renderReview();
    expect(screen.getByText('Code scan (SAST)')).toBeInTheDocument();
    expect(screen.getByText('my-app')).toBeInTheDocument();
    expect(screen.getByText('code.zip (2.5 MB)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start scan' })).toBeEnabled();
    expect(screen.queryByRole('list', { name: /Progress of starting/ })).not.toBeInTheDocument();
  });

  it('summarises an app scan with the test app name', () => {
    renderReview({ scanType: 'DAST', file: null, targetId: 'juice-shop' });
    expect(screen.getByText('App scan (DAST)')).toBeInTheDocument();
    expect(screen.getByText('OWASP Juice Shop (juice-shop)')).toBeInTheDocument();
  });

  it('goes back', async () => {
    const { onBack } = renderReview();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewStep while starting', () => {
  it('shows the three steps for a code scan, with live upload progress, and locks the buttons', async () => {
    let finish: () => void = () => {};
    upload.mockImplementation(({ onProgress }: { onProgress: (n: number) => void }) => {
      onProgress(0.45);
      return new Promise<void>((resolve) => (finish = resolve));
    });
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('button', { name: 'Start scan' }));

    const list = await screen.findByRole('list', { name: /Progress of starting/ });
    expect(within(list).getByText('Creating job')).toBeInTheDocument();
    expect(await within(list).findByText(/Uploading code 45%/)).toBeInTheDocument();
    expect(within(list).getByText('Queuing scan')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Upload progress' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );

    // No double clicks, and no leaving this step halfway.
    expect(screen.getByRole('button', { name: 'Start scan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    finish();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=j1'));
  });

  it('announces the stage to screen readers, and the upload in 25% steps', async () => {
    let finish: () => void = () => {};
    upload.mockImplementation(({ onProgress }: { onProgress: (n: number) => void }) => {
      onProgress(0.6);
      return new Promise<void>((resolve) => (finish = resolve));
    });
    renderReview();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Start scan' }));

    await waitFor(() => {
      const live = document.querySelector('[aria-live="polite"]');
      expect(live).toHaveTextContent('Uploading code, 50 percent');
    });
    finish();
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('an app scan has only two steps and no progress bar', async () => {
    renderReview({ scanType: 'DAST', file: null, targetId: 'juice-shop' });
    api.createScan.mockResolvedValue({ jobId: 'j9', status: 'CREATED' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Start scan' }));

    const list = await screen.findByRole('list', { name: /Progress of starting/ });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).queryByText(/Uploading/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=j9'));
  });
});

describe('ReviewStep failures', () => {
  it('a failed upload offers "Retry upload" and keeps the same job', async () => {
    upload.mockRejectedValueOnce(new UploadError('network', 0, 'dropped'));
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('button', { name: 'Start scan' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The scan could not be started.');
    expect(alert).toHaveTextContent(
      'The upload was interrupted. Check your connection and try again.',
    );
    expect(alert).toHaveTextContent('your file is still selected');
    expect(screen.queryByRole('button', { name: 'Start scan' })).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Retry upload' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/scans/detail/?jobId=j1'));
    expect(api.createScan).toHaveBeenCalledTimes(1);
  });

  it('an expired upload link offers to start over with a new scan', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.parse('2026-03-01T12:00:00Z');
    vi.setSystemTime(start);
    upload.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 901_000);
      throw new UploadError('http', 403, 'forbidden');
    });
    try {
      renderReview();
      await userEvent
        .setup({ advanceTimers: () => {} })
        .click(screen.getByRole('button', { name: 'Start scan' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('The upload link has expired');
      expect(
        within(alert).getByRole('button', { name: 'Start over with a new scan' }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the server message when the job cannot be created, with Try again', async () => {
    api.createScan.mockRejectedValueOnce(
      new ApiError(400, 'Unknown target. Choose one of the registered test apps.'),
    );
    renderReview({ scanType: 'DAST', file: null, targetId: 'juice-shop' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Start scan' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unknown target. Choose one of the registered test apps.');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
  });

  it('marks the step that failed in the checklist', async () => {
    api.startScan.mockRejectedValueOnce(new ApiError(500, 'Queue is down.'));
    renderReview();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Start scan' }));

    await screen.findByRole('alert');
    const items = within(screen.getByRole('list', { name: /Progress of starting/ })).getAllByRole(
      'listitem',
    );
    expect(items[0]).toHaveTextContent('(done)');
    expect(items[1]).toHaveTextContent('(done)');
    expect(items[2]).toHaveTextContent('(failed)');
  });
});
