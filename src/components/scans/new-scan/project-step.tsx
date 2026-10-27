'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROJECT_ID_HELP, projectIdSchema } from '@/lib/validation/project-id';

const formSchema = z.object({ projectId: projectIdSchema });
type FormValues = z.infer<typeof formSchema>;

const MAX_SUGGESTIONS = 6;

export function ProjectStep({
  initialValue,
  recentProjects,
  onBack,
  onContinue,
}: {
  initialValue: string;
  recentProjects: string[];
  onBack: () => void;
  onContinue: (projectId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { projectId: initialValue },
    // Check on every keystroke, so the user sees a problem as soon as they type it.
    mode: 'onChange',
  });

  const typed = useWatch({ control, name: 'projectId' });
  const error = errors.projectId?.message;
  const suggestions = recentProjects
    .filter((id) => id !== typed && id.includes(typed))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onContinue(values.projectId))}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="projectId">Project ID</Label>
        <Input
          id="projectId"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="font-mono"
          aria-invalid={error ? true : undefined}
          aria-describedby="projectId-help projectId-error"
          {...register('projectId')}
        />
        <p id="projectId-help" className="text-muted-foreground text-sm">
          {PROJECT_ID_HELP}
        </p>
        {/* Polite, so screen readers read each new problem without cutting the user off. */}
        <p id="projectId-error" aria-live="polite" className="text-destructive min-h-5 text-sm">
          {error}
        </p>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p id="recent-label" className="text-sm font-medium">
            Recent projects
          </p>
          <div role="group" aria-labelledby="recent-label" className="flex flex-wrap gap-2">
            {suggestions.map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                className="font-mono"
                onClick={() => setValue('projectId', id, { shouldValidate: true })}
              >
                {id}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}
