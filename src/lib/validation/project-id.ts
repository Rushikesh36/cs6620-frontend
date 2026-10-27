import { z } from 'zod';

export const PROJECT_ID_HELP =
  '3 to 50 characters. Lowercase letters, digits and hyphens only. Must start with a letter.';

/** A plain-words problem with the project ID, or null when it is fine. */
export function validateProjectId(value: string): string | null {
  if (value.length === 0) return 'Enter a project ID.';
  if (/[^a-z0-9-]/.test(value)) return 'Use only lowercase letters, digits and hyphens.';
  if (!/^[a-z]/.test(value)) return 'Start with a lowercase letter.';
  if (value.length < 3) return 'Use at least 3 characters.';
  if (value.length > 50) return 'Use 50 characters or fewer.';
  return null;
}

export const projectIdSchema = z.string().superRefine((value, ctx) => {
  const problem = validateProjectId(value);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});
