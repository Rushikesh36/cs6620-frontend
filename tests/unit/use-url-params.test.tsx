import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUrlParams } from '@/hooks/use-url-params';

const { replace, current } = vi.hoisted(() => ({ replace: vi.fn(), current: { query: '' } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(current.query),
  usePathname: () => '/projects/detail/',
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockClear();
  current.query = '';
});

describe('useUrlParams', () => {
  it('reads the current settings from the address', () => {
    current.query = 'projectId=demo-app&state=all';
    const { result } = renderHook(() => useUrlParams());
    expect(result.current.params.get('projectId')).toBe('demo-app');
    expect(result.current.params.get('state')).toBe('all');
  });

  it('adds a setting and keeps the others, without adding a history entry', () => {
    current.query = 'projectId=demo-app';
    const { result } = renderHook(() => useUrlParams());

    result.current.setParams({ state: 'fixed' });

    expect(replace).toHaveBeenCalledWith('/projects/detail/?projectId=demo-app&state=fixed');
  });

  it('changes a setting that is already there', () => {
    current.query = 'projectId=demo-app&state=fixed';
    const { result } = renderHook(() => useUrlParams());

    result.current.setParams({ state: 'all' });

    expect(replace).toHaveBeenCalledWith('/projects/detail/?projectId=demo-app&state=all');
  });

  it('removes a setting for null, and for an empty string', () => {
    current.query = 'projectId=demo-app&state=fixed&q=eval';
    const { result } = renderHook(() => useUrlParams());

    result.current.setParams({ state: null, q: '' });

    expect(replace).toHaveBeenCalledWith('/projects/detail/?projectId=demo-app');
  });

  it('goes to the bare page address when nothing is left', () => {
    current.query = 'state=fixed';
    const { result } = renderHook(() => useUrlParams());

    result.current.setParams({ state: null });

    expect(replace).toHaveBeenCalledWith('/projects/detail/');
  });

  it('encodes values, so odd characters cannot break the address', () => {
    const { result } = renderHook(() => useUrlParams());

    result.current.setParams({ q: 'a&b=c d#e' });

    expect(replace).toHaveBeenCalledWith('/projects/detail/?q=a%26b%3Dc+d%23e');
  });
});
