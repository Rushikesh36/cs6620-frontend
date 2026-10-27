// Stand-in for "msw/browser" while Next prerenders pages on the server (see next.config.ts).
// The real module is browser-only, and the mock never starts on the server anyway.
export function setupWorker(): never {
  throw new Error('The mock API only runs in the browser.');
}
