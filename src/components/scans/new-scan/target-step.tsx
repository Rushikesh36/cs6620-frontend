'use client';

import { Server, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { OptionCardsSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { useTargets } from '@/hooks/use-targets';
import { OptionCard } from './option-card';

export function TargetStep({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: string | null;
  onChange: (targetId: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { data: targets, isPending, isError, error, refetch } = useTargets();
  // A choice only counts if it is still on the allow-list the server just sent.
  const selected = targets?.find((target) => target.targetId === value) ?? null;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        For safety, you can only scan test apps registered by the team.
      </p>

      {isPending && <OptionCardsSkeleton label="Loading test apps" />}

      {isError && (
        <ErrorState
          title="We couldn't load the test apps"
          error={error}
          onRetry={() => void refetch()}
        />
      )}

      {targets && targets.length === 0 && (
        <EmptyState
          icon={Server}
          title="No test apps are registered yet."
          description="Ask the team to register one, then come back to run an app scan."
        />
      )}

      {targets && targets.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="sr-only">Test app to scan</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {targets.map((target) => (
              <OptionCard
                key={target.targetId}
                name="target"
                value={target.targetId}
                checked={selected?.targetId === target.targetId}
                onChange={() => onChange(target.targetId)}
                icon={Server}
                title={target.name}
                description={target.description}
                detail={target.targetId}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue} disabled={selected === null}>
          Continue
        </Button>
      </div>
    </div>
  );
}
