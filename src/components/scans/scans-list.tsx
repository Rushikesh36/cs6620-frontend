'use client';

import { FolderSearch, Loader2, RefreshCw, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/skeletons';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { useProjectScans } from '@/hooks/use-project-scans';
import { useRecentProjects } from '@/hooks/use-recent-projects';
import { useUrlParams } from '@/hooks/use-url-params';
import {
  isFinalStatus,
  scanStatusSchema,
  scanTypeSchema,
  type Scan,
  type ScanStatus,
  type ScanType,
} from '@/lib/api/schemas';
import { addRecentProject } from '@/lib/projects/recent-projects';
import { AUTO_REFRESH_MS, filterScans, sortScans, type ScanSort } from '@/lib/utils/scan-list';
import { validateProjectId } from '@/lib/validation/project-id';
import { ScanFilters } from './scan-filters';
import { ScansTable } from './scans-table';

export function ScansList({ showProjectPicker = true }: { showProjectPicker?: boolean }) {
  const { params, setParams } = useUrlParams();
  const { projects: recentProjects } = useRecentProjects();

  // Everything the page needs to remember lives in the address: project, filters and sort.
  const projectParam = params.get('projectId') ?? '';
  const projectProblem = projectParam ? validateProjectId(projectParam) : null;
  const projectId = projectParam && !projectProblem ? projectParam : null;
  const scanType: ScanType | null = scanTypeSchema.safeParse(params.get('scanType')).data ?? null;
  const status: ScanStatus | null = scanStatusSchema.safeParse(params.get('status')).data ?? null;
  const sort: ScanSort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';

  const view = (scans: Scan[]) => sortScans(filterScans(scans, { scanType, status }), sort);

  const query = useProjectScans(projectId, {
    // Only keep refreshing while a scan you can see is still going.
    autoRefreshWhile: (scans) => view(scans).some((scan) => !isFinalStatus(scan.status)),
  });

  const loaded = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const visible = view(loaded);
  const stillRunning = visible.some((scan) => !isFinalStatus(scan.status));
  const filtered = scanType !== null || status !== null;

  // A project with scans is one the user has worked with, so offer it again next time.
  useEffect(() => {
    if (projectId && loaded.length > 0) addRecentProject(projectId);
  }, [projectId, loaded.length]);

  return (
    <div className="space-y-6">
      {showProjectPicker && (
        <>
          {/* key: a new project ID starts the picker over with that value in it. */}
          <ProjectPicker
            key={projectParam}
            initialValue={projectParam}
            recentProjects={recentProjects}
            submitLabel="Show scans"
            onSubmit={(id) => setParams({ projectId: id })}
          />

          {projectProblem && (
            <p role="alert" className="text-destructive text-sm">
              The project ID in the link isn&apos;t valid. {projectProblem}
            </p>
          )}

          {!projectId && !projectProblem && (
            <EmptyState
              icon={FolderSearch}
              title="Choose a project"
              description="Enter a project ID, or pick a recent one, to see its scans."
            />
          )}
        </>
      )}

      {projectId && (
        <>
          <ScanFilters
            scanType={scanType}
            status={status}
            sort={sort}
            onChange={(updates) =>
              setParams({
                ...('type' in updates && { scanType: updates.type ?? null }),
                ...('status' in updates && { status: updates.status ?? null }),
                ...('sort' in updates && { sort: updates.sort === 'oldest' ? 'oldest' : null }),
              })
            }
          />

          {query.isPending && <TableSkeleton rows={5} columns={7} />}

          {query.isError && !query.data && (
            <ErrorState
              title="We couldn't load the scans"
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          )}

          {query.data && (
            <>
              {query.isRefetchError && (
                <p role="status" className="text-muted-foreground text-sm">
                  Couldn&apos;t refresh just now. Showing the last scans we loaded.
                </p>
              )}

              {loaded.length === 0 && (
                <EmptyState
                  icon={FolderSearch}
                  title="No scans for this project yet"
                  description="Start a scan and its results will appear here."
                  action={
                    <Button asChild>
                      <Link href={`/scans/new/?project=${encodeURIComponent(projectId)}`}>
                        Start a scan
                      </Link>
                    </Button>
                  }
                />
              )}

              {loaded.length > 0 && visible.length === 0 && (
                <EmptyState
                  icon={SearchX}
                  title="No scans match these filters"
                  description={
                    query.hasNextPage
                      ? 'Only the scans loaded so far are searched. Load more to look through older ones.'
                      : 'Try a different scan type or status.'
                  }
                  action={
                    filtered ? (
                      <Button
                        variant="outline"
                        onClick={() => setParams({ scanType: null, status: null })}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              )}

              {visible.length > 0 && <ScansTable scans={visible} />}

              {stillRunning && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <RefreshCw className="size-3.5" aria-hidden />
                  Updating every {AUTO_REFRESH_MS / 1000} seconds while scans are running.
                </p>
              )}

              {query.isFetchNextPageError && (
                <p role="alert" className="text-destructive text-sm">
                  We couldn&apos;t load more scans. Try again.
                </p>
              )}

              {query.hasNextPage && (
                <Button
                  variant="outline"
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage && (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                  )}
                  {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
