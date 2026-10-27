import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, useConfig } from '@/lib/config-provider';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const good = { apiBaseUrl: 'https://api.example.com/', environment: 'rushikesh-lab' };

function Child() {
  const { apiBaseUrl, environment } = useConfig();
  return <p>{`${environment} at ${apiBaseUrl}`}</p>;
}
const renderProvider = () =>
  render(
    <ConfigProvider>
      <Child />
    </ConfigProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('ConfigProvider', () => {
  it('shows a loader first, and renders nothing from the app until the config is in', async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))),
    );
    renderProvider();

    expect(screen.getByRole('status')).toHaveTextContent('Loading configuration');
    expect(screen.queryByText(/rushikesh-lab/)).not.toBeInTheDocument();

    finish(json(good));
    expect(await screen.findByText('rushikesh-lab at https://api.example.com')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('gives the app the cleaned-up config', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(good)),
    );
    renderProvider();
    expect(await screen.findByText('rushikesh-lab at https://api.example.com')).toBeInTheDocument();
  });

  it('shows a full-page configuration error instead of the app when the file is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    renderProvider();

    expect(await screen.findByRole('heading', { name: 'Configuration error' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('config.json was not found on this site.');
    expect(screen.queryByText(/rushikesh-lab/)).not.toBeInTheDocument();
    // Tells you what the file should look like, and where it comes from.
    expect(screen.getByText(/"apiBaseUrl"/)).toBeInTheDocument();
    expect(screen.getByText(/public\/config.example.json/)).toBeInTheDocument();
  });

  it('lists what is wrong when the file has the wrong contents', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ environment: '' })),
    );
    renderProvider();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('config.json has the wrong contents.');
    expect(alert).toHaveTextContent('"apiBaseUrl" is missing');
    expect(alert).toHaveTextContent('"environment" must not be empty');
  });

  it('tries again when you press Try again, and carries on once the file is fixed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValue(json(good));
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('rushikesh-lab at https://api.example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a plain message for a failure it does not know', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(good)),
    );
    const original = Response.prototype.json;
    Response.prototype.json = () => Promise.reject(new RangeError('boom: internals'));
    try {
      renderProvider();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('config.json is not valid JSON.');
      expect(alert).not.toHaveTextContent('internals');
    } finally {
      Response.prototype.json = original;
    }
  });

  it('stops asking if it is removed while still loading', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );
    const { unmount } = renderProvider();
    await waitFor(() => expect(signal).toBeDefined());

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('useConfig refuses to work outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Child />)).toThrow('useConfig must be used inside ConfigProvider');
    spy.mockRestore();
  });
});
