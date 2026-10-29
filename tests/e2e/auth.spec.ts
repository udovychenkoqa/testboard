import { expect, test } from '@playwright/test';

import { E2E_API_TOKEN } from '../../playwright.config';

// Signed-out browser for every test in this file.
test.use({ storageState: { cookies: [], origins: [] } });

test('a signed-out visit is sent to the login page', async ({ page }) => {
  await page.goto('/reports');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Sign in to continue')).toBeVisible();
});

test('a wrong API key shows an error and stays on login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/API Key/i).fill('definitely-not-the-key');
  await page.getByRole('button', { name: /Login with API Key/i }).click();
  await expect(page.getByText('Invalid API key')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('the right API key signs in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/API Key/i).fill(E2E_API_TOKEN);
  await page.getByRole('button', { name: /Login with API Key/i }).click();
  await expect(page).toHaveURL(/\/reports/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
});
