import { expect, test } from '@playwright/test';

import {
  addNamedProcessFromLibrary,
  byTestId,
  createNamedProcess,
  typeInto,
} from './helpers';

test.describe('library search and pin', () => {
  test('search filters the flat library by title', async ({ page }) => {
    await createNamedProcess(page, 'Pack camera');
    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();

    await addNamedProcessFromLibrary(page, 'Bike tune-up');
    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();
    await expect(page.getByText('Pack camera', { exact: true })).toBeVisible();
    await expect(page.getByText('Bike tune-up', { exact: true })).toBeVisible();

    await typeInto(page, 'library-search', 'bike');
    await expect(page.getByText('Bike tune-up', { exact: true })).toBeVisible();
    await expect(page.getByText('Pack camera', { exact: true })).toHaveCount(0);

    await typeInto(page, 'library-search', '');
    await expect(page.getByText('Pack camera', { exact: true })).toBeVisible();
    await expect(page.getByText('Bike tune-up', { exact: true })).toBeVisible();
  });

  test('pin marks a process and sorts it above unpinned rows', async ({ page }) => {
    await createNamedProcess(page, 'Older process');
    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();

    await addNamedProcessFromLibrary(page, 'Weekend kit');
    await byTestId(page, 'process-pin').click();
    await expect(byTestId(page, 'process-pin')).toContainText('Unpin');

    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();

    const rows = page.locator('[data-testid^="process-row-"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Weekend kit');
    await expect(rows.first()).toContainText('Pinned');
    await expect(rows.nth(1)).toContainText('Older process');
    await expect(rows.nth(1)).not.toContainText('Pinned');

    await page.getByText('Weekend kit', { exact: true }).click();
    await expect(byTestId(page, 'process-screen')).toBeVisible();
    await byTestId(page, 'process-pin').click();
    await expect(byTestId(page, 'process-pin')).toContainText('Pin');

    await page.goBack();
    await expect(byTestId(page, 'library-screen')).toBeVisible();
    await expect(page.getByText('Pinned', { exact: true })).toHaveCount(0);
  });
});
