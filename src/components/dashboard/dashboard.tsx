'use client';

import { FileCode2, Globe, ScanSearch } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { CardGridSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { ScansTable } from '@/components/scans/scans-table';
import { Button } from '@/components/ui/button';
import { useRecentProjects } from '@/hooks/use-recent-projects';
import { useRecentScans } from '@/hooks/use-recent-scans';
import { computeDashboardStats, RECENT_SCAN_COUNT } from '@/lib/utils/dashboard';
import { projectHref } from '@/lib/utils/project-links';
import { useNow } from '@/lib/utils/use-now';
import { StatCards } from './stat-cards';

export function Dashboard() {
  const { projects } = useRecentProjects();

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button asChild>
          <Link href="/scans/new/">Start a scan</Link>
        </Button>
      </header>

      {projects.length === 0 ? <FirstTimeWelcome /> : <DashboardContent projects={projects} />}
    </div>
  );
}

function FirstTimeWelcome() {
  return (
    <section aria-labelledby="welcome-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="welcome-title" className="text-xl font-semibold">
          Welcome to Unified Security Hub
        </h2>
        <p className="text-muted-foreground max-w-2xl">
          Scan your code and your running apps for security problems, and see every result in one
          place. There are two kinds of scan:
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border-border space-y-2 rounded-xl border p-5">
          <FileCode2 className="text-primary size-7" aria-hidden />
          <h3 className="font-semibold">Code scan (SAST)</h3>
          <p className="text-muted-foreground text-sm">
            Upload your code as a .zip. We read it for risky patterns without ever running it.
          </p>
        </div>
        <div className="border-border space-y-2 rounded-xl border p-5">
          <Globe className="text-primary size-7" aria-hidden />
          <h3 className="font-semibold">App scan (DAST)</h3>
          <p className="text-muted-foreground text-sm">
            We attack a running test app from the outside, the way a hacker would, to find
            weaknesses.
          </p>
        </div>
      </div>

      <Button asChild size="lg">
        <Link href="/scans/new/">Start your first scan</Link>
      </Button>
    </section>
  );
}

function DashboardContent({ projects }: { projects: string[] }) {
  const query = useRecentScans(projects);
  const now = useNow(60_000);

  if (query.isPending) {
    return (
      <div className="space-y-8">
        <CardGridSkeleton />
        <TableSkeleton rows={5} columns={8} />
      </div>
    );
  }

  if (query.allFailed) {
    return (
      <ErrorState
        title="We couldn't load your scans"
        error={query.error}
        onRetry={() => void query.refetchAll()}
      />
    );
  }

  const stats = computeDashboardStats(query.scans, now);

  return (
    <div className="space-y-8">
      {query.failedCount > 0 && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <span>
            We couldn&apos;t load the scans of {query.failedCount} of your {query.projectCount}{' '}
            projects, so the numbers below are incomplete.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="bg-background"
            onClick={() => void query.refetchAll()}
          >
            Try again
          </Button>
        </p>
      )}

      <StatCards stats={stats} />

      <section aria-labelledby="recent-scans-title" className="space-y-4">
        <h2 id="recent-scans-title" className="text-lg font-semibold">
          Recent scans
        </h2>
        {stats.recentScans.length === 0 ? (
          <EmptyState
            icon={ScanSearch}
            title="No scans yet in your recent projects"
            description="Start a scan and it will show up here."
            action={
              <Button asChild>
                <Link href="/scans/new/">Start a scan</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ScansTable scans={stats.recentScans} showProject />
            <p className="text-muted-foreground text-sm">
              The latest {RECENT_SCAN_COUNT} scans from the projects you have used in this browser
              tab.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="recent-projects-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-projects-title" className="text-lg font-semibold">
            Recent projects
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects/">All projects</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {projects.map((id) => (
            <li key={id}>
              <Button asChild variant="outline" size="sm" className="font-mono">
                <Link href={projectHref(id)}>{id}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
