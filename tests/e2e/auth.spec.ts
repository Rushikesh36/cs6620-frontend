import { expect, test } from './fixtures';
import { logIn } from './helpers';

test('a wrong password shows an error, and demo / demo123 gets you in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\//); // logged-out visitors are sent to the login page

  await page.getByLabel('Username', { exact: true }).fill('demo');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  // (Next also keeps a hidden role=alert element for page changes, so find ours by its text.)
  await expect(
    page.getByRole('alert').filter({ hasText: 'Wrong username or password.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\//);

  await page.getByLabel('Password', { exact: true }).fill('demo123');
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/dashboard\//);

  // The header shows who is logged in and which lab this is.
  const header = page.getByRole('banner');
  await expect(header.getByText('demo', { exact: true })).toBeVisible();
  await expect(header.getByText('e2e', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Unified Security Hub' }),
  ).toBeVisible();
});

test('logging out clears the session and shows a message', async ({ page }) => {
  await logIn(page);
  await page.getByRole('button', { name: 'Log out demo' }).click();

  await expect(page).toHaveURL(/\/login\/\?reason=signed-out/);
  await expect(page.getByText('You have been logged out.')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('ush-session'))).toBeNull();

  // And the pages that need a login are closed again.
  await page.goto('/dashboard/');
  await expect(page).toHaveURL(/\/login\/\?next=%2Fdashboard%2F/);
});

test('an expired token sends you to the login page with the session expired message', async ({
  page,
}) => {
  await logIn(page);

  // Swap the token for one the (mock) server will refuse as expired.
  await page.evaluate(() => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    const session = JSON.parse(sessionStorage.getItem('ush-session') ?? '{}');
    session.token = `${encode({ alg: 'HS256' })}.${encode({ sub: 'demo', role: 'user', exp: 1 })}.mock-signature`;
    sessionStorage.setItem('ush-session', JSON.stringify(session));
  });
  await page.goto('/scans/?projectId=demo-app'); // a page that asks the API for data

  await expect(page).toHaveURL(/\/login\/\?reason=expired/);
  await expect(page.getByText('Your session expired, please log in again.')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('ush-session'))).toBeNull();
});

test('a session that runs out while you are on a page logs you out by itself', async ({ page }) => {
  await logIn(page);
  await page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem('ush-session') ?? '{}');
    session.expiresAt = Date.now() + 6000; // inside the last 5 minutes, and soon over
    sessionStorage.setItem('ush-session', JSON.stringify(session));
  });
  await page.reload();

  await expect(page.getByText('Your session expires in 5 minutes.')).toBeVisible();
  await expect(page).toHaveURL(/\/login\/\?reason=expired/, { timeout: 15_000 });
  await expect(page.getByText('Your session expired, please log in again.')).toBeVisible();
});

test('an address that does not exist shows the friendly 404 page', async ({ page }) => {
  const response = await page.goto('/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the dashboard' })).toBeVisible();
});
