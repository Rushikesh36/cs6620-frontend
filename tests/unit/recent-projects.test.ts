import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecentProject,
  MAX_RECENT_PROJECTS,
  readRecentProjects,
} from '@/lib/projects/recent-projects';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('recent projects', () => {
  it('starts empty', () => {
    expect(readRecentProjects()).toEqual([]);
  });

  it('puts the newest project first and keeps no duplicates', () => {
    addRecentProject('first-app');
    addRecentProject('second-app');
    addRecentProject('first-app');
    expect(readRecentProjects()).toEqual(['first-app', 'second-app']);
  });

  it('keeps only the most recent ten', () => {
    for (let i = 0; i < 15; i++) addRecentProject(`project-${String.fromCharCode(97 + i)}`);
    const list = readRecentProjects();
    expect(list).toHaveLength(MAX_RECENT_PROJECTS);
    expect(list[0]).toBe('project-o');
  });

  it('refuses IDs that are not valid, so junk never reaches the suggestions', () => {
    addRecentProject('Bad ID');
    addRecentProject('<script>');
    expect(readRecentProjects()).toEqual([]);
  });

  it('uses sessionStorage only, never localStorage', () => {
    addRecentProject('demo-app');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
  });

  it('ignores damaged or hand-edited storage', () => {
    sessionStorage.setItem('ush-recent-projects', '{not json');
    expect(readRecentProjects()).toEqual([]);

    sessionStorage.setItem('ush-recent-projects', JSON.stringify([1, 2]));
    expect(readRecentProjects()).toEqual([]);

    sessionStorage.setItem(
      'ush-recent-projects',
      JSON.stringify(['good-one', '<img onerror=x>', 'X']),
    );
    expect(readRecentProjects()).toEqual(['good-one']);
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => addRecentProject('demo-app')).not.toThrow();
    expect(readRecentProjects()).toEqual([]);
  });
});
