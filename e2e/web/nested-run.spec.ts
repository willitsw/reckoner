import { expect, test } from '@playwright/test';

import {
  addNamedProcessFromLibrary,
  addStep,
  byTestId,
  createNamedProcess,
} from './helpers';

test.describe('nested run', () => {
  test('include expands inline on a run and checking a child completes the parent step', async ({
    page,
  }) => {
    await createNamedProcess(page, 'Gear checklist');
    await addStep(page, 'Rain jacket');
    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();

    await addNamedProcessFromLibrary(page, 'Day hike');
    await addStep(page, 'Pack gear');
    await byTestId(page, 'process-dismiss-keyboard').click();
    await byTestId(page, 'step-include').click();
    await expect(byTestId(page, 'include-picker')).toBeVisible();
    await expect(byTestId(page, 'include-picker-new')).toBeVisible();
    await page
      .locator('[data-testid^="include-picker-row-"]')
      .filter({ hasText: 'Gear checklist' })
      .click();
    await expect(byTestId(page, 'step-include-open')).toBeVisible();
    await expect(page.getByText('Includes Gear checklist')).toBeVisible();

    await byTestId(page, 'process-run').click();
    const run = byTestId(page, 'run-screen');
    await expect(run).toBeVisible();
    await expect(byTestId(page, 'run-progress')).toHaveText('0 of 1');
    await expect(run.getByRole('checkbox', { name: 'Pack gear' })).toBeVisible();
    await expect(run.getByRole('checkbox', { name: 'Rain jacket' })).toBeVisible();
    await expect(run.getByText('Includes Gear checklist')).toBeVisible();

    await run.getByRole('checkbox', { name: 'Rain jacket' }).click();
    await expect(byTestId(page, 'run-progress')).toHaveText('1 of 1');
    await byTestId(page, 'run-done').click();
    await expect(byTestId(page, 'process-screen')).toBeVisible();
  });
});

test.describe('web media chrome', () => {
  test('web offers Add image but not Camera', async ({ page }) => {
    await createNamedProcess(page, 'Trail snacks');
    await expect(byTestId(page, 'process-attach-image')).toBeVisible();
    await expect(byTestId(page, 'process-camera-image')).toHaveCount(0);
  });
});
