import { expect, test as base } from '@playwright/test';

// Every test also fails if the page breaks the Content Security Policy or throws an error nobody
// caught, even when the visible result still looks right.
const PROBLEM = /Content Security Policy|Refused to|Uncaught|hydrat/i;

export const test = base.extend<{ watchForProblems: void }>({
  watchForProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`Page error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' && PROBLEM.test(message.text()))
          problems.push(message.text());
      });
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
