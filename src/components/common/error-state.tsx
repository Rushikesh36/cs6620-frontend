import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

const FALLBACK = 'Something went wrong. Please try again.';

/** The message to show for any error. Server and network messages are already in plain words. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError && error.message ? error.message : FALLBACK;
}

/** A failed load, in plain words, with a way to try again. Never a blank screen. */
export function ErrorState({
  title = "We couldn't load this",
  error,
  onRetry,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center"
    >
      <TriangleAlert className="text-destructive size-8" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
