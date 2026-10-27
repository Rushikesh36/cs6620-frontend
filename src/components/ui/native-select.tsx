import { cn } from '@/lib/utils';

/** The browser's own drop-down: accessible, works well on phones, and needs no extra library. */
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3',
        className,
      )}
      {...props}
    />
  );
}
