import { expect, type Page } from '@playwright/test';

export async function logIn(page: Page, username = 'demo', password = 'demo123') {
  await page.goto('/login/');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard\//);
}

/** A file that looks like a zip to the form. The mock backend never opens it. */
export const smallZip = {
  name: 'code.zip',
  mimeType: 'application/zip',
  buffer: Buffer.concat([Buffer.from('PK\u0005\u0006'), Buffer.alloc(18)]),
};

/** The radio-button cards on the new scan page are visually hidden, so choose them by their label. */
export async function chooseCard(page: Page, name: RegExp) {
  await page.getByRole('radio', { name }).check({ force: true });
}

export async function startScanFlow(
  page: Page,
  options: { type: 'SAST' | 'DAST'; project: string },
) {
  await page.goto('/scans/new/');
  await chooseCard(page, options.type === 'SAST' ? /Code scan/ : /App scan/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Project ID').fill(options.project);
  await page.getByRole('button', { name: 'Continue' }).click();

  if (options.type === 'SAST') {
    await page.locator('input[type="file"]').setInputFiles(smallZip);
    await expect(page.getByText('code.zip')).toBeVisible();
  } else {
    await chooseCard(page, /OWASP Juice Shop/);
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start scan' }).click();
  await expect(page).toHaveURL(/\/scans\/detail\/\?jobId=/);
}
