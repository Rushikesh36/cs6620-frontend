import { expect, test } from './fixtures';
import { logIn, startScanFlow } from './helpers';

test('a code scan: upload a zip, watch it complete, open its findings', async ({ page }) => {
  await logIn(page);
  await startScanFlow(page, { type: 'SAST', project: 'e2e-sast' });

  // The detail page follows the scan until it is finished.
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByLabel('Scan results')).toContainText('New HIGH');
  await expect(page.locator('main header')).toContainText('Completed');

  await page.getByRole('link', { name: 'View findings' }).click();
  await expect(page).toHaveURL(/\/projects\/detail\/\?projectId=e2e-sast&scanType=SAST/);
  await expect(page.getByRole('tab', { name: 'SAST findings' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('Showing 1 to 9 of 9 findings')).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(10); // 9 findings and the header
});

test('an app scan on Juice Shop reaches a final status', async ({ page }) => {
  await logIn(page);
  await startScanFlow(page, { type: 'DAST', project: 'e2e-dast' });

  await expect(page.locator('main header')).toContainText(/Completed|Failed/);
  await expect(page.getByText('Test app: juice-shop')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Details', exact: true })).toBeVisible();
});

test('a failed scan shows why, and "Start the same scan again" pre-fills the form', async ({
  page,
}) => {
  await logIn(page);
  await startScanFlow(page, { type: 'DAST', project: 'fail-demo' }); // this project always fails

  const alert = page.getByRole('alert').filter({ hasText: 'This scan failed.' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Scanner message:');

  await alert.getByRole('link', { name: 'Start the same scan again' }).click();

  await expect(page).toHaveURL(/\/scans\/new\/\?type=DAST&project=fail-demo&target=juice-shop/);
  await expect(page.getByRole('heading', { name: 'Name the project' })).toBeVisible();
  await expect(page.getByLabel('Project ID')).toHaveValue('fail-demo');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('radio', { name: /OWASP Juice Shop/ })).toBeChecked();
});

test('a scan you start appears in the scan history and on the dashboard', async ({ page }) => {
  await logIn(page);
  await startScanFlow(page, { type: 'DAST', project: 'e2e-history' });
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

  await page.getByRole('link', { name: 'Scans', exact: true }).click();
  await page.getByLabel('Project ID').fill('e2e-history');
  await page.getByRole('button', { name: 'Show scans' }).click();
  await expect(page).toHaveURL(/projectId=e2e-history/);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2); // the header and our scan

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByLabel('Summary')).toContainText('Scans in the last 7 days');
  await expect(page.getByRole('region', { name: 'Recent projects' })).toContainText('e2e-history');
});
