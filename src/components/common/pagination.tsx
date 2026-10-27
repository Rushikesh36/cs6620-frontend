import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils/format';

/** "Showing 51 to 100 of 120 findings", with Previous and Next when there is more than one page. */
export function Pagination({
  page,
  pages,
  from,
  to,
  total,
  noun,
  onPageChange,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  /** Plural, for the summary: "findings". */
  noun: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Showing {formatNumber(from)} to {formatNumber(to)} of {formatNumber(total)} {noun}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  );
}
