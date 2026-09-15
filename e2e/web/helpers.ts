import { expect, type Page } from '@playwright/test';

/** React Native Web maps `testID` → `data-testid`. */
export function byTestId(page: Page, id: string) {
  return page.getByTestId(id);
}

export async function signIn(
  page: Page,
  email = 'e2e@example.com',
  password = 'secret-password',
) {
  await page.goto('/');
  await expect(byTestId(page, 'sign-in-screen')).toBeVisible();
  await byTestId(page, 'sign-in-email').fill(email);
  await byTestId(page, 'sign-in-password').fill(password);
  await byTestId(page, 'sign-in-submit').click();
  await expect(byTestId(page, 'library-screen')).toBeVisible();
}

export async function blurActive(page: Page) {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
}
