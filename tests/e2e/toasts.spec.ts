import { expect, test } from '@playwright/test';

import { E2E_BASE_URL } from '../../playwright.config';

import { useLanguage } from './helpers';

// GITLAB_URL points at gitlab.invalid, so starting a run always fails upstream.
for (const [locale, title] of [
  ['en', "Couldn't reach an external service"],
  ['uk', "Не вдалося зв'язатися з зовнішнім сервісом"],
] as const) {
  test(`an unreachable upstream shows a readable toast (${locale})`, async ({ page, context }) => {
    await useLanguage(context, locale, E2E_BASE_URL);
    await page.goto('/runs/automated');

    await page.getByRole('button', { name: locale === 'uk' ? 'Запустити' : 'Run', exact: true }).click();

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: title });

    await expect(toast).toBeVisible();
    // Never the raw response body.
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'fetch failed' })).toHaveCount(0);
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Network response was not ok' })).toHaveCount(0);
  });
}
