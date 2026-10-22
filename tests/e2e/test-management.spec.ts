import { expect, test } from '@playwright/test';

import { E2E_API_TOKEN, E2E_BASE_URL } from '../../playwright.config';

import { collectConsoleErrors, useLanguage } from './helpers';

test.describe('test management', () => {
  test.beforeEach(async ({ context }) => {
    await useLanguage(context, 'en', E2E_BASE_URL);
  });

  test('project → suite → cases → manual run with results', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);
    // Unique per run, so a reused dev server with old data doesn't collide.
    const n = String(Date.now()).slice(-6);
    const key = `e2e-tm-${n}`;
    const code = `TM${n}`;

    // Project
    await page.goto('/cases');
    await page.getByRole('button', { name: 'New project' }).first().click();
    const projectDialog = page.getByRole('dialog');

    await projectDialog.getByLabel('Name').fill(`E2E Shop ${n}`);
    await projectDialog.getByLabel('Key').fill(key);
    await projectDialog.getByLabel('Code').fill(code);
    await projectDialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Project created' })).toBeVisible();

    // Creating a project opens it.
    await expect(page).toHaveURL(new RegExp(`/cases/${key}$`));

    // Suite
    await page.getByRole('button', { name: 'New suite' }).first().click();
    const suiteDialog = page.getByRole('dialog');

    await suiteDialog.getByLabel('Name').fill('Checkout');
    await suiteDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Checkout').first()).toBeVisible();

    // Case with two steps
    await page.getByRole('button', { name: 'New case' }).first().click();
    const drawer = page.getByRole('dialog');

    await drawer.getByLabel('Title').fill('Pay with a saved card');
    await drawer.getByRole('button', { name: 'Add step' }).click();
    await drawer.getByRole('button', { name: 'Add step' }).click();
    await drawer.getByPlaceholder('Action').nth(0).fill('Open the cart');
    await drawer.getByPlaceholder('Expected result').nth(0).fill('Cart total is shown');
    await drawer.getByPlaceholder('Action').nth(1).fill('Pay with the saved card');
    await drawer.getByPlaceholder('Expected result').nth(1).fill('Order is confirmed');
    await drawer.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: `Case ${code}-1 created` })).toBeVisible();

    // A second, step-less case
    await page.getByRole('button', { name: 'New case' }).first().click();
    await page.getByRole('dialog').getByLabel('Title').fill('Apply a promo code');
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: `Case ${code}-2 created` })).toBeVisible();
    await expect(page.getByText(`${code}-2`, { exact: true })).toBeVisible();

    // Run over all cases (the project picked on the cases page is remembered)
    await page.goto('/runs/manual');
    await page.getByRole('button', { name: 'New run' }).first().click();
    const runDialog = page.getByRole('dialog');

    await runDialog.getByLabel('Run name').fill('Smoke');
    await runDialog.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/runs\/manual\/\d+$/);
    await expect(page.getByText('0 / 2 done')).toBeVisible();

    // Mark results; the panel moves on to the next untested case by itself.
    await page.getByRole('button', { name: new RegExp(`${code}-1`) }).click();
    const panel = page.getByRole('dialog');

    await expect(panel.getByText('Order is confirmed')).toBeVisible();
    await panel.getByRole('button', { name: 'Passed' }).click();
    await expect(panel.getByText('Apply a promo code')).toBeVisible();
    await panel.getByRole('button', { name: 'Failed' }).click();
    await expect(panel).toBeHidden();

    await expect(page.getByText('2 / 2 done')).toBeVisible();
    await expect(page.getByText('Passed: 1')).toBeVisible();
    await expect(page.getByText('Failed: 1')).toBeVisible();

    // Back on the list, the run shows its progress too.
    await page.getByRole('link', { name: 'All runs' }).click();
    await expect(page.getByRole('link', { name: /Smoke/ })).toContainText('2 / 2 done');

    expect(errors).toEqual([]);
  });

  test('renaming a project keeps its key and code', async ({ page, request }) => {
    const key = `e2e-ren-${String(Date.now()).slice(-6)}`;

    expect(
      (
        await request.post('/api/tm/projects', {
          headers: { Authorization: E2E_API_TOKEN },
          data: { key, name: `Old ${key}`, code: 'REN' },
        })
      ).ok(),
    ).toBeTruthy();

    await page.goto('/cases');
    await page.locator('div.group', { hasText: key }).getByRole('button', { name: 'Rename' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('textbox').fill(`New ${key}`);
    await dialog.getByRole('button', { name: 'Save' }).click();

    const card = page.locator('div.group', { hasText: key });

    await expect(card).toContainText(`New ${key}`);
    await expect(card).toContainText('REN');
  });

  test('deleting a project needs its key typed and removes it', async ({ page, request }) => {
    const key = `e2e-del-${String(Date.now()).slice(-6)}`;

    expect(
      (
        await request.post('/api/tm/projects', {
          headers: { Authorization: E2E_API_TOKEN },
          data: { key, name: `Delete me ${key}`, code: 'DEL' },
        })
      ).ok(),
    ).toBeTruthy();

    await page.goto('/cases');
    const card = page.locator('div.group', { hasText: key });

    await card.getByRole('button', { name: 'Delete project' }).click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: 'Delete project' });

    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('wrong-key');
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill(key);
    await confirm.click();

    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'deleted' })).toBeVisible();
    await expect(page.getByText(key, { exact: true })).toHaveCount(0);
  });

  test('a run that does not exist says so instead of loading forever', async ({ page }) => {
    await page.goto('/runs/manual/999999');
    await expect(page.getByText('Run not found')).toBeVisible();
    await page.getByText('All runs').click();
    await expect(page).toHaveURL(/\/runs\/manual$/);
  });

  test('the old Run Tests address opens the Automated tab', async ({ page }) => {
    await page.goto('/run-tests');
    await expect(page).toHaveURL(/\/runs\/automated$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Test Runs' })).toBeVisible();
  });
});
