import { expect, test } from '@playwright/test';

import { E2E_BASE_URL } from '../../playwright.config';

import { loadSeed, useLanguage } from './helpers';

test.beforeEach(async ({ context }) => {
  await useLanguage(context, 'en', E2E_BASE_URL);
});

test('a search with no matches offers Clear filters, which brings the list back', async ({ page }) => {
  const { reportId } = await loadSeed();
  const row = page.getByText(reportId.slice(0, 8)).or(page.getByText(reportId)).first();

  await page.goto('/reports');
  await expect(row).toBeVisible();

  await page.getByPlaceholder('Search…').fill('zzz-nothing-matches-this');
  await expect(page.getByText('No matching reports')).toBeVisible();
  await expect(row).toBeHidden();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(row).toBeVisible();
  await expect(page.getByPlaceholder('Search…')).toHaveValue('');
});

test('Results shows the uploaded result', async ({ page }) => {
  await page.goto('/results');
  await expect(page.getByRole('heading', { level: 1, name: 'Results' })).toBeVisible();
  await expect(page.getByText('No test results yet')).toBeHidden();
});
