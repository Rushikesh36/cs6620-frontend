import path from 'node:path';
import type { NextConfig } from 'next';

// The site is served from an S3 static website: no Node server, so everything
// must be exportable to plain files in `out/`.
const nextConfig: NextConfig = {
  output: 'export',
  // `/scans/` -> `scans/index.html`, which is what S3 website hosting serves.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Always define the flag. Next only inlines NEXT_PUBLIC_* variables that exist at build
  // time, and inlining is what lets the bundler drop the mock code from normal builds.
  env: { NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ? 'true' : 'false' },
  // A stray lockfile higher up the tree otherwise makes Next guess the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // "msw/browser" is marked browser-only, so the server-side prerender can't resolve it.
      // Give the server a stub and the browser the real file.
      'msw/browser': {
        browser: './node_modules/msw/lib/browser/index.js',
        default: './src/mocks/empty.ts',
      },
    },
  },
};

export default nextConfig;
