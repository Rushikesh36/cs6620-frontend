import { Skeleton } from '@/components/ui/skeleton';

// Loading placeholders shaped like the content that will replace them, so the page doesn't jump.
// Screen readers get one "Loading" message instead of a pile of empty boxes.

function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <LoadingRegion label="Loading table">
      <div className="border-border space-y-3 rounded-xl border p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-4">
            {Array.from({ length: columns }, (_, col) => (
              <Skeleton key={col} className="h-6 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function CardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <LoadingRegion label="Loading summary">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="border-border space-y-3 rounded-xl border p-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-1/3" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Placeholder for a row of selectable cards, like the test apps to choose from. */
export function OptionCardsSkeleton({ label, cards = 2 }: { label: string; cards?: number }) {
  return (
    <LoadingRegion label={label}>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="border-border space-y-3 rounded-xl border-2 p-5">
            <Skeleton className="size-8" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
