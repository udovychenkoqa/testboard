import { expect, test } from '@playwright/test';

import { E2E_BASE_URL } from '../../playwright.config';

import { loadSeed, useLanguage } from './helpers';

const RAW_401 =
  'Anthropic API 401: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_x"}';

test('a failed AI summary is explained in plain words, with the raw error tucked away', async ({ page, context }) => {
  await useLanguage(context, 'uk', E2E_BASE_URL);
  const { reportId } = await loadSeed();

  // Pretend the summary was attempted with a bad key: no summary file, a stored "failed" status.
  await page.route('**/ai-summary.md*', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/ai-summary-status.json*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'failed', reason: RAW_401 }),
    }),
  );

  // The panel only shows for reports with failures; the seeded report is all green, so mark one as failed.
  await page.route(`**/api/report/${reportId}`, async (route) => {
    const response = await route.fetch();
    const report = await response.json();

    await route.fulfill({ response, json: { ...report, stats: { ...report.stats, unexpected: 1 } } });
  });

  await page.goto(`/report/${reportId}`);

  await expect(page.getByText('ключ Anthropic недійсний або відкликаний', { exact: false })).toBeVisible();
  const raw = page.getByText('invalid x-api-key', { exact: false });

  await expect(raw).toBeHidden();
  await page.getByText('Технічні деталі').click();
  await expect(raw).toBeVisible();
});
