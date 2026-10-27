'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROJECT_ID_HELP, projectIdSchema } from '@/lib/validation/project-id';

const formSchema = z.object({ projectId: projectIdSchema });
type FormValues = z.infer<typeof formSchema>;

const MAX_SUGGESTIONS = 6;

/** Type a project ID (or pick a recent one) and open it. */
export function ProjectPicker({
  initialValue = '',
  recentProjects,
  submitLabel,
  onSubmit,
}: {
  initialValue?: string;
  recentProjects: string[];
  submitLabel: string;
  onSubmit: (projectId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { projectId: initialValue },
    mode: 'onChange',
  });
  const error = errors.projectId?.message;

  return (
    <div className="space-y-3">
      <form
        noValidate
        onSubmit={handleSubmit((values) => onSubmit(values.projectId))}
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        <div className="max-w-sm flex-1 space-y-2">
          <Label htmlFor="project-picker">Project ID</Label>
          <Input
            id="project-picker"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono"
            aria-invalid={error ? true : undefined}
            aria-describedby="project-picker-help project-picker-error"
            {...register('projectId')}
          />
          <p id="project-picker-help" className="text-muted-foreground text-xs">
            {PROJECT_ID_HELP}
          </p>
          <p
            id="project-picker-error"
            aria-live="polite"
            className="text-destructive min-h-4 text-sm"
          >
            {error}
          </p>
        </div>
        <Button type="submit" className="sm:mt-[1.625rem]">
          {submitLabel}
        </Button>
      </form>

      {recentProjects.length > 0 && (
        <div className="space-y-2">
          <p id="picker-recent-label" className="text-sm font-medium">
            Recent projects
          </p>
          <div role="group" aria-labelledby="picker-recent-label" className="flex flex-wrap gap-2">
            {recentProjects.slice(0, MAX_SUGGESTIONS).map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                className="font-mono"
                onClick={() => onSubmit(id)}
              >
                {id}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
