import { z } from 'zod';
import { validateProjectId } from '@/lib/validation/project-id';

// sessionStorage, like the login: this list is private to the tab and gone when it closes.
const STORAGE_KEY = 'ush-recent-projects';
export const MAX_RECENT_PROJECTS = 10;

const listSchema = z.array(z.string());

/** Recently used project IDs, most recent first. */
export function readRecentProjects(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = listSchema.safeParse(JSON.parse(raw));
    // Drop anything that isn't a valid project ID, in case the stored list was edited by hand.
    return parsed.success ? parsed.data.filter((id) => validateProjectId(id) === null) : [];
  } catch {
    return [];
  }
}

/** Puts a project at the front of the list (without duplicates) and returns the new list. */
export function addRecentProject(projectId: string): string[] {
  if (validateProjectId(projectId) !== null) return readRecentProjects();
  const next = [projectId, ...readRecentProjects().filter((id) => id !== projectId)].slice(
    0,
    MAX_RECENT_PROJECTS,
  );
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: suggestions just won't be remembered.
  }
  return next;
}
