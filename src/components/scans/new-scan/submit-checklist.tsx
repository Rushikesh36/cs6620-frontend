import { Check, Circle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChecklistState = 'pending' | 'active' | 'done' | 'failed';
export type ChecklistItem = { key: string; label: string; state: ChecklistState };

const STATE_LABEL: Record<ChecklistState, string> = {
  pending: 'waiting',
  active: 'in progress',
  done: 'done',
  failed: 'failed',
};

/** "Creating job / Uploading code 45% / Queuing scan", each with its own state. */
export function SubmitChecklist({
  items,
  uploadPercent,
}: {
  items: ChecklistItem[];
  uploadPercent: number | null;
}) {
  return (
    <ol className="space-y-3" aria-label="Progress of starting the scan">
      {items.map((item) => (
        <li key={item.key} className="space-y-2">
          <div
            className={cn(
              'flex items-center gap-3 text-sm',
              item.state === 'pending' && 'text-muted-foreground',
            )}
          >
            <StateIcon state={item.state} />
            <span className={cn(item.state === 'active' && 'font-medium')}>
              {item.label}
              {item.key === 'upload' && uploadPercent !== null && item.state !== 'pending' && (
                <> {uploadPercent}%</>
              )}
            </span>
            <span className="sr-only">({STATE_LABEL[item.state]})</span>
          </div>
          {item.key === 'upload' && uploadPercent !== null && item.state !== 'pending' && (
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadPercent}
              className="bg-muted ml-8 h-2 overflow-hidden rounded-full"
            >
              <div
                className={cn(
                  'h-full transition-[width] duration-200 motion-reduce:transition-none',
                  item.state === 'failed' ? 'bg-destructive' : 'bg-primary',
                )}
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function StateIcon({ state }: { state: ChecklistState }) {
  const base = 'size-5 shrink-0';
  switch (state) {
    case 'done':
      return <Check aria-hidden className={cn(base, 'text-green-600 dark:text-green-400')} />;
    case 'failed':
      return <X aria-hidden className={cn(base, 'text-destructive')} />;
    case 'active':
      return (
        <Loader2
          aria-hidden
          className={cn(base, 'text-primary animate-spin motion-reduce:animate-none')}
        />
      );
    default:
      return <Circle aria-hidden className={cn(base, 'text-muted-foreground')} />;
  }
}
