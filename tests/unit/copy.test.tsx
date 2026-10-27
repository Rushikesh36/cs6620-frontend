import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '@/components/common/copy-button';
import { copyToClipboard } from '@/lib/utils/clipboard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}
function setExecCommand(impl: ((command: string) => boolean) | undefined) {
  Object.defineProperty(document, 'execCommand', {
    value: impl,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  setClipboard(undefined);
  setExecCommand(undefined);
});

describe('copyToClipboard', () => {
  it('uses the Clipboard API when the page has it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyToClipboard('abc')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('falls back to a hidden text box on plain HTTP, where navigator.clipboard is missing', async () => {
    setClipboard(undefined);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await expect(copyToClipboard('abc')).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).not.toBeInTheDocument(); // cleaned up
  });

  it('falls back when the Clipboard API refuses', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setExecCommand(() => true);
    await expect(copyToClipboard('abc')).resolves.toBe(true);
  });

  it('reports failure when nothing works', async () => {
    setClipboard(undefined);
    setExecCommand(() => false);
    await expect(copyToClipboard('abc')).resolves.toBe(false);

    setExecCommand(() => {
      throw new Error('not allowed');
    });
    await expect(copyToClipboard('abc')).resolves.toBe(false);
  });
});

describe('CopyButton', () => {
  it('copies the value, says so in a toast and shows a check mark', async () => {
    const user = userEvent.setup(); // installs its own fake clipboard, so set ours after it
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CopyButton value="job-123" label="job ID" />);

    await user.click(screen.getByRole('button', { name: 'Copy job ID' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Copied to clipboard'));
    expect(writeText).toHaveBeenCalledWith('job-123');
  });

  it('tells the user when copying did not work', async () => {
    const user = userEvent.setup();
    setClipboard(undefined);
    setExecCommand(() => false);
    render(<CopyButton value="job-123" label="job ID" />);

    await user.click(screen.getByRole('button', { name: 'Copy job ID' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
