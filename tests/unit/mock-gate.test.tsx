import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockGate } from '@/lib/mock-gate';

// The spy only records calls. The promise comes from a plain function, because vitest's spies
// track the promises they return and report a rejected one as unhandled.
const { startCalls, start } = vi.hoisted(() => ({
  startCalls: vi.fn(),
  start: { current: (): Promise<void> => Promise.resolve() },
}));
vi.mock('@/mocks/browser', () => ({
  startMocks: (apiBaseUrl: string) => {
    startCalls(apiBaseUrl);
    return start.current();
  },
}));
vi.mock('@/lib/config-provider', () => ({
  useConfig: () => ({ apiBaseUrl: 'https://api.example.com', environment: 'test' }),
}));

const renderGate = () =>
  render(
    <MockGate>
      <p>the app</p>
    </MockGate>,
  );

beforeEach(() => {
  startCalls.mockReset();
  start.current = () => Promise.resolve();
});
afterEach(() => vi.unstubAllEnvs());

describe('MockGate with mocks turned off', () => {
  it('shows the app straight away, starts nothing, and shows no badge', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    renderGate();

    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(startCalls).not.toHaveBeenCalled();
    expect(screen.queryByText('Mock API')).not.toBeInTheDocument();
  });

  it('treats a missing setting as off', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '');
    renderGate();
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(startCalls).not.toHaveBeenCalled();
  });
});

describe('MockGate with mocks turned on', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true'));

  it('holds the app back until the fake API is running, then shows it with a "Mock API" badge', async () => {
    let started: () => void = () => {};
    start.current = () => new Promise<void>((resolve) => (started = resolve));
    renderGate();

    expect(screen.getByRole('status')).toHaveTextContent('Starting the mock API');
    expect(screen.queryByText('the app')).not.toBeInTheDocument();
    await waitFor(() => expect(startCalls).toHaveBeenCalledWith('https://api.example.com'));

    started();
    expect(await screen.findByText('the app')).toBeInTheDocument();
    expect(screen.getByText('Mock API')).toBeInTheDocument();
  });

  it('explains what to check when the fake API cannot start, and does not show the app', async () => {
    start.current = () => Promise.reject(new Error('no service worker'));
    renderGate();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The mock API could not start.');
    expect(alert).toHaveTextContent('mockServiceWorker.js');
    expect(screen.queryByText('the app')).not.toBeInTheDocument();
  });
});
