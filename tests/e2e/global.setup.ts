import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { expect, test as setup } from '@playwright/test';

import { E2E_API_TOKEN, E2E_AUTH_STATE } from '../../playwright.config';

import { E2E_PROJECT, saveSeed } from './helpers';

setup.describe.configure({ mode: 'serial' });

// Seed the isolated server through its real API: upload a Playwright blob and
// generate a report from it. A failure here fails the whole run — specs must
// never pass against an empty server.
setup('seed a report', async ({ request }) => {
  setup.setTimeout(180_000);
  const headers = { Authorization: E2E_API_TOKEN };
  const blob = await readFile(path.join(__dirname, 'fixtures/blob.zip'));

  const upload = await request.put('/api/result/upload', {
    headers,
    multipart: {
      file: { name: 'blob.zip', mimeType: 'application/zip', buffer: blob },
      project: E2E_PROJECT,
    },
  });

  expect(upload.ok(), await upload.text()).toBeTruthy();
  const resultID: string = (await upload.json()).data.resultID;

  expect(resultID).toBeTruthy();

  // No playwrightVersion → the server merges with the locally installed Playwright (no network).
  const generate = await request.post('/api/report/generate', {
    headers,
    data: { resultsIds: [resultID], project: E2E_PROJECT },
    timeout: 150_000,
  });

  expect(generate.ok(), await generate.text()).toBeTruthy();
  const reportId: string = (await generate.json()).reportId;

  expect(reportId).toBeTruthy();
  await saveSeed({ resultID, reportId });
});

setup('sign in with the API key', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/API Key/i).fill(E2E_API_TOKEN);
  await page.getByRole('button', { name: /Login with API Key/i }).click();
  await expect(page).toHaveURL(/\/reports/);
  await page.context().storageState({ path: E2E_AUTH_STATE });
});
