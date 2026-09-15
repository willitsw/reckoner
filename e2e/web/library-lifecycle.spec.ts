import { expect, test } from '@playwright/test';

import { byTestId, createNamedProcess } from './helpers';

test.describe('library lifecycle', () => {
  test('archive hides a process until it is unarchived', async ({ page }) => {
    await createNamedProcess(page, 'Bike tune-up');

    await byTestId(page, 'process-archive').click();
    await expect(byTestId(page, 'process-archived-banner')).toBeVisible();
    await expect(byTestId(page, 'process-unarchive')).toBeVisible();

    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();
    await expect(byTestId(page, 'library-empty')).toBeVisible();
    await expect(page.getByText('Bike tune-up', { exact: true })).toHaveCount(0);

    await byTestId(page, 'library-archive-toggle').click();
    await expect(page.getByText('Bike tune-up', { exact: true })).toBeVisible();

    await page.getByText('Bike tune-up', { exact: true }).click();
    await expect(byTestId(page, 'process-screen')).toBeVisible();
    await byTestId(page, 'process-unarchive').click();
    await expect(byTestId(page, 'process-archive')).toBeVisible();
    await expect(byTestId(page, 'process-archived-banner')).toHaveCount(0);

    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();
    // Still on the archived list after unarchive — toggle back to the live library.
    await byTestId(page, 'library-archive-toggle').click();
    await expect(page.getByText('Bike tune-up', { exact: true })).toBeVisible();
  });

  test('delete removes a process from the library', async ({ page }) => {
    await createNamedProcess(page, 'Sourdough');

    await byTestId(page, 'process-delete').scrollIntoViewIfNeeded();
    await byTestId(page, 'process-delete').click();
    await byTestId(page, 'process-delete-confirm').click();

    await expect(byTestId(page, 'library-screen')).toBeVisible();
    await expect(byTestId(page, 'library-empty')).toBeVisible();
    await expect(page.getByText('Sourdough', { exact: true })).toHaveCount(0);

    await byTestId(page, 'library-archive-toggle').click();
    await expect(byTestId(page, 'library-empty')).toBeVisible();
    await expect(page.getByText('Nothing archived')).toBeVisible();
    await expect(page.getByText('Sourdough', { exact: true })).toHaveCount(0);
  });
});
