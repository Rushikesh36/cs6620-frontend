import { describe, expect, it } from 'vitest';
import { projectIdSchema, validateProjectId } from '@/lib/validation/project-id';

describe('validateProjectId', () => {
  it.each(['abc', 'demo-app', 'a1b', 'my-project-2', 'a-b', 'a'.repeat(50)])(
    'accepts "%s"',
    (value) => {
      expect(validateProjectId(value)).toBeNull();
    },
  );

  it.each([
    ['', 'Enter a project ID.'],
    ['ab', 'Use at least 3 characters.'],
    ['a'.repeat(51), 'Use 50 characters or fewer.'],
    ['1abc', 'Start with a lowercase letter.'],
    ['-abc', 'Start with a lowercase letter.'],
    ['My-App', 'Use only lowercase letters, digits and hyphens.'],
    ['my_app', 'Use only lowercase letters, digits and hyphens.'],
    ['my app', 'Use only lowercase letters, digits and hyphens.'],
    ['my.app', 'Use only lowercase letters, digits and hyphens.'],
    ['café', 'Use only lowercase letters, digits and hyphens.'],
    ['abc ', 'Use only lowercase letters, digits and hyphens.'],
    ['../etc', 'Use only lowercase letters, digits and hyphens.'],
  ])('rejects "%s" with a plain message', (value, message) => {
    expect(validateProjectId(value)).toBe(message);
  });

  it('draws the 3 and 50 character edges correctly', () => {
    expect(validateProjectId('abc')).toBeNull();
    expect(validateProjectId('ab')).not.toBeNull();
    expect(validateProjectId('a'.repeat(50))).toBeNull();
    expect(validateProjectId('a'.repeat(51))).not.toBeNull();
  });
});

describe('projectIdSchema', () => {
  it('accepts valid IDs and carries the message of the first problem', () => {
    expect(projectIdSchema.safeParse('demo-app').success).toBe(true);
    const result = projectIdSchema.safeParse('Demo');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Use only lowercase letters, digits and hyphens.',
    );
  });
});
