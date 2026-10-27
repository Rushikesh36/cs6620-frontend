import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "1 Scan type > 2 Project > ..." The current step is marked for screen readers too. */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex flex-wrap gap-x-4 gap-y-2">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 text-sm',
                active ? 'text-foreground font-semibold' : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-xs',
                  done && 'bg-primary text-primary-foreground border-primary',
                  active && 'border-primary text-primary',
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span>
                {label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
