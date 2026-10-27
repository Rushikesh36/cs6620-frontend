import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

/** What to show when there is nothing yet: say why, and offer the next step. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <Icon className="text-muted-foreground size-8" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
      {action}
    </div>
  );
}
