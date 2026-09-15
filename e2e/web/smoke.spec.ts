import { expect, test } from '@playwright/test';

import { byTestId, signIn, typeInto } from './helpers';

test.describe('auth gate', () => {
  test('signed-out users land on sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(byTestId(page, 'sign-in-screen')).toBeVisible();
    await expect(byTestId(page, 'sign-in-email')).toBeVisible();
  });
});

test.describe('smoke', () => {
  test('sign in, create a process, run a step, and sign out', async ({ page }) => {
    await signIn(page);

    await expect(byTestId(page, 'library-empty')).toBeVisible();
    await byTestId(page, 'library-new-process').click();
    await expect(byTestId(page, 'process-screen')).toBeVisible();

    await typeInto(page, 'process-title', 'Pack camera');
    await expect(byTestId(page, 'process-title')).toHaveValue('Pack camera');

    await typeInto(page, 'process-new-step', 'Charge batteries');
    await byTestId(page, 'process-add-step').click();
    await expect(page.locator('[data-testid^="step-body-"]')).toHaveValue('Charge batteries');
    // Title must survive the reload that follows creating a step.
    await expect(byTestId(page, 'process-title')).toHaveValue('Pack camera');

    await byTestId(page, 'process-run').click();
    await expect(byTestId(page, 'run-screen')).toBeVisible();
    await expect(byTestId(page, 'run-progress')).toHaveText('0 of 1');

    await page.getByRole('checkbox', { name: 'Charge batteries' }).click();
    await expect(byTestId(page, 'run-progress')).toHaveText('1 of 1');

    await page.goBack();
    await expect(byTestId(page, 'process-screen')).toBeVisible();
    await expect(byTestId(page, 'process-title')).toHaveValue('Pack camera');
    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();
    await expect(page.getByText('Pack camera', { exact: true })).toBeVisible();

    await byTestId(page, 'tab-account').click();
    await expect(byTestId(page, 'account-screen')).toBeVisible();
    await byTestId(page, 'account-sign-out').click();
    await expect(byTestId(page, 'sign-in-screen')).toBeVisible();
  });
});
