import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, normalizePath } from '@/components/layout/nav-items';

const activeFor = (path: string) =>
  NAV_ITEMS.filter((item) => item.isActive(normalizePath(path))).map((item) => item.label);

describe('sidebar navigation', () => {
  it('has the four items from the spec, in order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Dashboard',
      'New Scan',
      'Scans',
      'Projects',
    ]);
  });

  it('highlights exactly one item for each page', () => {
    expect(activeFor('/dashboard/')).toEqual(['Dashboard']);
    expect(activeFor('/scans/new/')).toEqual(['New Scan']);
    expect(activeFor('/scans/')).toEqual(['Scans']);
    expect(activeFor('/scans/detail/')).toEqual(['Scans']);
    expect(activeFor('/projects/')).toEqual(['Projects']);
    expect(activeFor('/projects/detail/')).toEqual(['Projects']);
  });

  it('highlights nothing for pages outside the menu', () => {
    expect(activeFor('/login/')).toEqual([]);
    expect(activeFor('/scansfoo/')).toEqual([]);
  });

  it('removes trailing slashes but keeps the root', () => {
    expect(normalizePath('/scans/')).toBe('/scans');
    expect(normalizePath('/scans/new///')).toBe('/scans/new');
    expect(normalizePath('/')).toBe('/');
  });
});
