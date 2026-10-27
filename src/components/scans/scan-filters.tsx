'use client';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  scanStatusSchema,
  scanTypeSchema,
  type ScanStatus,
  type ScanType,
} from '@/lib/api/schemas';
import type { ScanSort } from '@/lib/utils/scan-list';

const STATUS_LABELS: Record<ScanStatus, string> = {
  CREATED: 'Created',
  QUEUED: 'Queued',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export function ScanFilters({
  scanType,
  status,
  sort,
  onChange,
}: {
  scanType: ScanType | null;
  status: ScanStatus | null;
  sort: ScanSort;
  onChange: (updates: {
    type?: ScanType | null;
    status?: ScanStatus | null;
    sort?: ScanSort;
  }) => void;
}) {
  return (
    <div role="group" aria-label="Filter and sort scans" className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="filter-type">Scan type</Label>
        <NativeSelect
          id="filter-type"
          value={scanType ?? ''}
          onChange={(event) =>
            onChange({ type: scanTypeSchema.safeParse(event.target.value).data ?? null })
          }
        >
          <option value="">All types</option>
          <option value="SAST">Code scan (SAST)</option>
          <option value="DAST">App scan (DAST)</option>
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-status">Status</Label>
        <NativeSelect
          id="filter-status"
          value={status ?? ''}
          onChange={(event) =>
            onChange({ status: scanStatusSchema.safeParse(event.target.value).data ?? null })
          }
        >
          <option value="">All statuses</option>
          {scanStatusSchema.options.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="sort-scans">Sort by date</Label>
        <NativeSelect
          id="sort-scans"
          value={sort}
          onChange={(event) =>
            onChange({ sort: event.target.value === 'oldest' ? 'oldest' : 'newest' })
          }
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </NativeSelect>
      </div>
    </div>
  );
}
