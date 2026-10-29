import { expect, test } from '@playwright/test';

import { E2E_BASE_URL } from '../../playwright.config';

import { useLanguage } from './helpers';

test.describe('Automated runs (GitLab)', () => {
  test.beforeEach(async ({ context }) => {
    await useLanguage(context, 'en', E2E_BASE_URL);
  });

  test('the form mirrors the autotests pipeline inputs', async ({ page }) => {
    await page.goto('/runs/automated');

    // HeroUI Select = a visible trigger button plus a hidden native <select>.
    await expect(page.getByRole('button', { name: /Environment/ })).toContainText('prod');
    await expect(page.getByRole('button', { name: /Mode/ })).toContainText('By tag');
    await expect(page.locator('input[aria-label="Tag"]')).toHaveValue('@smoke');
    // Fields from the old Drone form are gone.
    await expect(page.getByText('Funnel')).toHaveCount(0);
    await expect(page.getByText('Country')).toHaveCount(0);

    await expect(page.getByRole('textbox', { name: 'Qase run ID' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Advanced' }).click();
    await expect(page.getByRole('textbox', { name: 'Qase run ID' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Qase case IDs' })).toBeVisible();
    await expect(page.getByText('Skip visual checks')).toBeVisible();
    await expect(page.getByText('Re-collect snapshots even if baselines exist')).toBeVisible();
  });
});
