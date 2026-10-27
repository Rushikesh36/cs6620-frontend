import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Generated or third-party-shaped files, and the pages that only wire up tested parts.
      exclude: [
        'src/components/ui/**',
        'src/app/**',
        'src/mocks/browser.ts',
        'src/mocks/empty.ts',
        'src/**/*.d.ts',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
