import { expect, test } from '@playwright/test';

import { E2E_BASE_URL } from '../../playwright.config';

import { collectConsoleErrors, loadSeed, useLanguage } from './helpers';

const PAGES = {
  en: [
    ['/reports', 'Reports'],
    ['/results', 'Results'],
    ['/trends', 'Trends'],
    ['/run-tests', 'Run Tests'],
    ['/settings', 'Settings'],
  ],
  uk: [
    ['/reports', 'Репорти'],
    ['/results', 'Результати'],
    ['/trends', 'Тренди'],
    ['/run-tests', 'Запуск тестів'],
    ['/settings', 'Налаштування'],
  ],
} as const;

for (const locale of ['en', 'uk'] as const) {
  test.describe(`pages render cleanly (${locale})`, () => {
    test.beforeEach(async ({ context }) => {
      await useLanguage(context, locale, E2E_BASE_URL);
    });

    for (const [path, heading] of PAGES[locale]) {
      test(path, async ({ page }) => {
        const errors = collectConsoleErrors(page);

        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        // Let client queries settle before judging the console.
        await page.waitForLoadState('networkidle');
        expect(errors).toEqual([]);
      });
    }

    test('report page', async ({ page }) => {
      const { reportId } = await loadSeed();
      const errors = collectConsoleErrors(page);

      await page.goto(`/report/${reportId}`);
      await expect(page.getByRole('link', { name: locale === 'uk' ? 'Репорти' : 'Reports' }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  });
}
