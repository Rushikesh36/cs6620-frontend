import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(import.meta.dirname, '../../src/app/globals.css'), 'utf8');

// Guards for the global accessibility rules, so a later edit to the stylesheet cannot drop them
// without a test failing.
describe('global accessibility styles', () => {
  it('draws a visible outline on anything with keyboard focus that has no style of its own', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ring\)/);
  });

  it('turns off animation and transitions for people who asked for less motion', () => {
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\s*\}\s*\n/.exec(css)?.[1] ?? '';
    expect(block).toContain('animation-duration: 0.01ms !important');
    expect(block).toContain('animation-iteration-count: 1 !important');
    expect(block).toContain('transition-duration: 0.01ms !important');
  });

  it('keeps the page language set for screen readers', () => {
    const layout = readFileSync(
      path.resolve(import.meta.dirname, '../../src/app/layout.tsx'),
      'utf8',
    );
    expect(layout).toContain('lang="en"');
  });
});
