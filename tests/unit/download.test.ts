import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '@/lib/utils/download';

describe('downloadTextFile', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:fake-url');
  const revokeObjectURL = vi.fn();
  let clicked: HTMLAnchorElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clicked = null;
    // The link is added to the page, clicked, then removed: remember it while it is there.
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) clicked = node;
      return node;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saves the text under the given name, using a temporary link that it then removes', () => {
    downloadTextFile('findings.csv', 'a,b\r\n1,2\r\n');

    expect(clicked?.download).toBe('findings.csv');
    expect(clicked?.href).toBe('blob:fake-url');
    expect(document.body.removeChild).toHaveBeenCalledWith(clicked);
  });

  it('makes a UTF-8 file that starts with a byte order mark, so Excel reads accents correctly', async () => {
    downloadTextFile('f.csv', 'café');

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(
      await new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(blob);
      }),
    );
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('café');
  });

  it('releases the temporary address a moment later', () => {
    downloadTextFile('f.csv', 'x');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });
});
