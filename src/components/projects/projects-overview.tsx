'use client';

import { FolderOpen, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRecentProjects } from '@/hooks/use-recent-projects';
import { projectHref, projectScansHref } from '@/lib/utils/project-links';
import { ProjectPicker } from './project-picker';

export function ProjectsOverview() {
  const router = useRouter();
  const { projects, remember } = useRecentProjects();
  const [search, setSearch] = useState('');

  const needle = search.trim().toLowerCase();
  const shown = needle ? projects.filter((id) => id.includes(needle)) : projects;

  return (
    <div className="space-y-10">
      <section aria-labelledby="open-title" className="space-y-3">
        <h2 id="open-title" className="text-lg font-semibold">
          Open a project
        </h2>
        <p className="text-muted-foreground text-sm">
          Enter the ID of any project to see its findings and scan history.
        </p>
        {/* No list of "all projects" exists in the API, so people open a project by its ID. */}
        <ProjectPicker
          recentProjects={[]}
          submitLabel="Open project"
          onSubmit={(id) => {
            remember(id);
            router.push(projectHref(id));
          }}
        />
      </section>

      <section aria-labelledby="recent-title" className="space-y-4">
        <h2 id="recent-title" className="text-lg font-semibold">
          Recent projects
        </h2>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No recent projects yet"
            description="Projects you scan or open show up here. Start a scan, or open a project by its ID above."
            action={
              <Button asChild>
                <Link href="/scans/new/">Start a scan</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="project-search">Search recent projects</Label>
              <Input
                id="project-search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <p className="sr-only" aria-live="polite">
              {shown.length} {shown.length === 1 ? 'project' : 'projects'} shown
            </p>

            {shown.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No recent project matches your search"
                description="Check the spelling, or open the project by its ID above."
                action={
                  <Button variant="outline" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <ul className="border-border divide-border max-w-2xl divide-y rounded-xl border">
                {shown.map((id) => (
                  <li
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <Link
                      href={projectHref(id)}
                      className="text-primary font-mono font-medium underline-offset-4 hover:underline"
                    >
                      {id}
                    </Link>
                    <Button asChild variant="outline" size="sm">
                      <Link href={projectScansHref(id)}>
                        View scans <span className="sr-only">for {id}</span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
