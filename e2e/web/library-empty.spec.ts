import { expect, test } from '@playwright/test';

import { byTestId, signIn } from './helpers';

test.describe('library empty state', () => {
  test('shows hobby-oriented empty copy for a new library', async ({ page }) => {
    await signIn(page, 'empty-state@example.com', 'secret-password');

    await expect(byTestId(page, 'library-empty')).toBeVisible();
    await expect(byTestId(page, 'library-empty-title')).toHaveText('No processes yet');
    await expect(byTestId(page, 'library-empty-body')).toContainText('pack-out');
    await expect(byTestId(page, 'library-empty-body')).toContainText('tune-up');
    // Product decision: no auto-seed for new users. (Dev-only "Load sample
    // processes" may appear under expo start where __DEV__ is true.)
    await expect(page.getByText('Pack camera bag', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Bike tune-up', { exact: true })).toHaveCount(0);
  });

  test('archived empty state stays practical when nothing is archived', async ({ page }) => {
    await signIn(page, 'empty-archived@example.com', 'secret-password');

    await byTestId(page, 'library-archive-toggle').click();
    await expect(byTestId(page, 'library-empty')).toBeVisible();
    await expect(byTestId(page, 'library-empty-title')).toHaveText('Nothing archived');
    await expect(byTestId(page, 'library-empty-body')).toContainText('out of the library');
  });
});
