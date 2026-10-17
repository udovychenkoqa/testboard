import { expect, test } from '@playwright/test';

import { E2E_BASE_URL } from '../../playwright.config';

import { loadSeed, useLanguage } from './helpers';

test.describe('default language', () => {
  test.use({ locale: 'uk-UA' });

  test('follows a Ukrainian browser when nothing was chosen', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(page.getByRole('heading', { level: 1, name: 'Репорти' })).toBeVisible();
  });
});

test.describe('language switch (login page)', () => {
  test.use({ storageState: { cookies: [], origins: [] }, locale: 'en-US' });

  test('flips the UI without a reload and remembers the choice', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to continue')).toBeVisible();

    // Mark the document: a full reload would drop this flag.
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    await page.getByTitle('Українська').click();

    await expect(page.getByText('Увійдіть, щоб продовжити')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

    await page.reload();
    await expect(page.getByText('Увійдіть, щоб продовжити')).toBeVisible();

    await page.getByTitle('English').click();
    await expect(page.getByText('Sign in to continue')).toBeVisible();
  });
});

test.describe('Ukrainian UI when signed in', () => {
  test.beforeEach(async ({ context }) => {
    await useLanguage(context, 'uk', E2E_BASE_URL);
  });

  for (const [path, heading] of [
    ['/reports', 'Репорти'],
    ['/results', 'Результати'],
    ['/trends', 'Тренди'],
    ['/cases', 'Тест-кейси'],
    ['/runs/manual', 'Тест-прогони'],
    ['/runs/automated', 'Тест-прогони'],
    ['/settings', 'Налаштування'],
  ] as const) {
    test(`${path} is in Ukrainian`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      // Sidebar follows the language too.
      await expect(page.getByRole('link', { name: 'Тренди' })).toBeVisible();
    });
  }

  test('a report page is in Ukrainian', async ({ page }) => {
    const { reportId } = await loadSeed();

    await page.goto(`/report/${reportId}`);
    await expect(page.getByRole('link', { name: 'Репорти' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Поділитися' })).toBeVisible();
  });
});
