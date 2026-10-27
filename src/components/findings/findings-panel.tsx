'use client';

import { Download, FileSearch, SearchX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Pagination } from '@/components/common/pagination';
import { TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { useFindings } from '@/hooks/use-findings';
import { useUrlParams } from '@/hooks/use-url-params';
import type { ScanType } from '@/lib/api/schemas';
import { findingsFilename, findingsToCsv } from '@/lib/utils/csv';
import { downloadTextFile } from '@/lib/utils/download';
import { FindingDrawer } from './finding-drawer';
import {
  countBySeverity,
  filterFindings,
  paginate,
  parseFindingSort,
  parsePage,
  parseSeverities,
  parseStateFilter,
  sortFindings,
} from '@/lib/utils/findings';
import { FindingsFilters } from './findings-filters';
import { FindingsTable } from './findings-table';
import { SeverityFilter } from './severity-filter';
import { useState } from 'react';
import { toast } from 'sonner';

const TYPE_NAMES: Record<ScanType, string> = { SAST: 'code scan', DAST: 'app scan' };

/** One tab of the project page: the findings of one scan type, with filters, sorting and paging. */
export function FindingsPanel({ projectId, scanType }: { projectId: string; scanType: ScanType }) {
  const { params, setParams } = useUrlParams();
  const { data: findings, isPending, isError, error, refetch } = useFindings(projectId, scanType);

  // The whole view lives in the address: a link brings back the same filters, sort and page.
  const severities = parseSeverities(params.get('severity'));
  const state = parseStateFilter(params.get('state'));
  const sort = parseFindingSort(params.get('sort'));
  const query = params.get('q') ?? '';
  const requestedPage = parsePage(params.get('page'));
  // Bumped by "Clear filters", so the search box starts over empty.
  const [searchKey, setSearchKey] = useState(0);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);

  // Any change to a filter or the sort starts again at page 1.
  const change = (updates: Record<string, string | null>) => setParams({ ...updates, page: null });
  const clearFilters = () => {
    setParams({ severity: null, state: null, q: null, sort: null, page: null });
    setSearchKey((key) => key + 1);
  };

  if (isPending) return <TableSkeleton rows={6} columns={7} />;
  if (isError) {
    return (
      <ErrorState
        title="We couldn't load the findings"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  if (findings.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title={`No ${scanType} findings yet`}
        description={`Run a ${TYPE_NAMES[scanType]} on this project and its findings will show up here.`}
        action={
          <Button asChild>
            <Link href={`/scans/new/?type=${scanType}&project=${encodeURIComponent(projectId)}`}>
              Start a {TYPE_NAMES[scanType]}
            </Link>
          </Button>
        }
      />
    );
  }

  // The severity numbers follow state and search, but not the severity choice itself.
  const beforeSeverity = filterFindings(findings, { severities: [], state, query });
  const counts = countBySeverity(beforeSeverity);
  const shown = sortFindings(
    severities.length
      ? beforeSeverity.filter((f) => severities.includes(f.severity))
      : beforeSeverity,
    sort,
  );
  const page = paginate(shown, requestedPage);
  // If a refresh removes the finding that is open, the drawer closes with it.
  const selected = findings.find((f) => f.fingerprint === selectedFingerprint) ?? null;
  const canClear =
    severities.length > 0 || state !== 'open' || query.trim() !== '' || sort !== 'severity';

  return (
    <div className="space-y-6">
      <SeverityFilter
        counts={counts}
        selected={severities}
        onChange={(next) => change({ severity: next.length ? next.join(',') : null })}
      />

      <FindingsFilters
        key={searchKey}
        state={state}
        sort={sort}
        query={query}
        canClear={canClear}
        onChange={(updates) =>
          change({
            ...('state' in updates && {
              state: updates.state === 'open' ? null : (updates.state ?? null),
            }),
            ...('sort' in updates && {
              sort: updates.sort === 'severity' ? null : (updates.sort ?? null),
            }),
            ...('query' in updates && { q: updates.query?.trim() ? updates.query : null }),
          })
        }
        onClear={clearFilters}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No findings match these filters"
          description={
            state === 'open' && findings.some((f) => f.state === 'FIXED')
              ? 'Only open findings are shown. Set State to Fixed or All to include fixed ones.'
              : 'Try removing a filter or changing the search.'
          }
          action={
            canClear ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                // Every finding that matches the filters, not just the page on screen.
                downloadTextFile(findingsFilename(projectId, scanType), findingsToCsv(shown));
                toast.success(
                  `Exported ${shown.length} ${shown.length === 1 ? 'finding' : 'findings'} to CSV`,
                );
              }}
            >
              <Download aria-hidden />
              Export CSV{' '}
              <span className="sr-only">({shown.length} findings that match the filters)</span>
            </Button>
          </div>
          <FindingsTable
            findings={page.items}
            onSelect={(f) => setSelectedFingerprint(f.fingerprint)}
          />
          <Pagination
            page={page.page}
            pages={page.pages}
            from={page.from}
            to={page.to}
            total={page.total}
            noun={page.total === 1 ? 'finding' : 'findings'}
            onPageChange={(next) => setParams({ page: next === 1 ? null : String(next) })}
          />
        </>
      )}
      <FindingDrawer finding={selected} onClose={() => setSelectedFingerprint(null)} />
    </div>
  );
}
