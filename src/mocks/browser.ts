import { setupWorker } from 'msw/browser';
import { MockBackend } from './backend';
import { createHandlers } from './handlers';
import { optionsFromEnv } from './options';

const started = new Map<string, Promise<void>>();

/** Starts the in-browser mock API at `apiBaseUrl`. Safe to call twice (React Strict Mode). */
export function startMocks(apiBaseUrl: string): Promise<void> {
  let promise = started.get(apiBaseUrl);
  if (!promise) {
    const worker = setupWorker(...createHandlers(apiBaseUrl, new MockBackend(optionsFromEnv())));
    // Anything we don't mock (pages, config.json, fonts) goes through untouched.
    promise = worker.start({ onUnhandledFrame: 'bypass', quiet: true }).then(() => undefined);
    started.set(apiBaseUrl, promise);
  }
  return promise;
}
