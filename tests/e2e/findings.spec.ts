import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { logIn } from './helpers';

const rowCount = (page: Page) => page.locator('table tbody tr').count();

test('findings filters and search change the table and the address', async ({ page }) => {
  await logIn(page);
  await page.goto('/projects/detail/?projectId=demo-app');
  await expect(page.getByRole('table')).toBeVisible();
  const openRows = await rowCount(page);
  expect(openRows).toBeGreaterThan(3);

  // Severity: press High, and only high findings are left.
  await page.getByRole('button', { name: /^High:/ }).click();
  await expect(page).toHaveURL(/severity=HIGH/);
  await expect(page.getByRole('button', { name: /^High:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const severities = await page.locator('table tbody tr td:first-child').allTextContents();
  expect(severities.length).toBeGreaterThan(0);
  expect(severities.every((text) => text.trim() === 'High')).toBe(true);

  // Search: only findings that mention the text. (In the seeded history, "eval" has already been fixed,
  // so this looks for a high-severity finding that is still open.)
  await page.getByLabel('Search').fill('subprocess');
  await expect(page).toHaveURL(/q=subprocess/);
  const rows = await page.locator('table tbody tr').allTextContents();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((text) => /subprocess/i.test(text))).toBe(true);

  // State: Fixed findings are hidden by default, and "All" brings them back.
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).not.toHaveURL(/severity=|q=/);
  await page.getByLabel('State').selectOption('all');
  await expect(page).toHaveURL(/state=all/);
  await expect.poll(() => rowCount(page)).toBeGreaterThan(openRows);
  await expect(page.locator('table tbody tr').filter({ hasText: 'Fixed' }).first()).toBeVisible();
});

test('the filters live in the address, so a reload or a shared link shows the same view', async ({
  page,
}) => {
  await logIn(page);
  await page.goto(
    '/projects/detail/?projectId=demo-app&severity=HIGH,MEDIUM&state=all&q=py&sort=rule',
  );

  await expect(page.getByRole('button', { name: /^High:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /^Medium:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /^Low:/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByLabel('State')).toHaveValue('all');
  await expect(page.getByLabel('Search')).toHaveValue('py');
  await expect(page.getByLabel('Sort by')).toHaveValue('rule');

  // Sorted by rule ID, as asked.
  const rules = await page.locator('table tbody tr td:nth-child(2)').allTextContents();
  expect(rules.length).toBeGreaterThan(1);
  expect(rules).toEqual([...rules].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));

  await page.reload();
  await expect(page.getByLabel('Search')).toHaveValue('py');
  await expect(page.getByRole('button', { name: /^High:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a long list is split into pages of 50, and the whole filtered list can be exported', async ({
  page,
}) => {
  await logIn(page);
  await page.goto('/projects/detail/?projectId=many-findings');

  await expect(page.getByText('Showing 1 to 50 of 90 findings')).toBeVisible();
  expect(await rowCount(page)).toBe(50);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('Showing 51 to 90 of 90 findings')).toBeVisible();
  expect(await rowCount(page)).toBe(40);

  // Opening a finding shows everything about it, and Escape closes it again.
  await page.locator('table tbody tr').first().getByRole('button').first().click();
  const drawer = page.getByRole('dialog', { name: 'Finding details' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Fingerprint', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  // The export holds all 90 matching findings, not only the page on screen.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export CSV/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^findings-many-findings-sast-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  const text = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '');
  expect(text.startsWith('Severity,Rule ID,Location,Message,State,')).toBe(true);
  expect(text.trim().split('\r\n')).toHaveLength(91); // the header and 90 findings
});

test('the three tabs: SAST findings, DAST findings and scan history', async ({ page }) => {
  await logIn(page);
  await page.goto('/projects/detail/?projectId=demo-app');
  await expect(page.getByRole('tab', { name: 'SAST findings' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: 'DAST findings' }).click();
  await expect(page).toHaveURL(/scanType=DAST/);
  await expect(page.getByRole('table')).toContainText('zap.');

  await page.getByRole('tab', { name: 'Scan history' }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.getByRole('table')).toContainText('Requested by');
  await expect(page.getByLabel('Project ID')).toHaveCount(0); // no project picker inside a project
});
