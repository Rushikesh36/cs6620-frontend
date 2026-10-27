import { Loader2 } from 'lucide-react';

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3"
    >
      <Loader2
        className="text-primary size-8 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-muted-foreground text-sm">{label}…</p>
    </div>
  );
}
