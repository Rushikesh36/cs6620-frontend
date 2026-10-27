'use client';

import { useCallback, useState } from 'react';
import { addRecentProject, readRecentProjects } from '@/lib/projects/recent-projects';

/** The recent project IDs of this tab, plus a way to remember one. */
export function useRecentProjects() {
  // Safe to read storage while rendering: pages behind the login guard only render in the browser.
  const [projects, setProjects] = useState(readRecentProjects);
  const remember = useCallback((projectId: string) => setProjects(addRecentProject(projectId)), []);
  return { projects, remember };
}
