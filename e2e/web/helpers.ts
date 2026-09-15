import { expect, type Page } from '@playwright/test';

/** React Native Web maps `testID` → `data-testid`. */
export function byTestId(page: Page, id: string) {
  return page.getByTestId(id);
}

/**
 * Set text on an RN Web TextInput so React state updates.
 * Plain Playwright fill/type often changes the DOM only; controlled RN inputs
 * then revert on the next render (e.g. after a reload following "Add step").
 */
export async function typeInto(page: Page, testId: string, value: string) {
  const field = byTestId(page, testId);
  await field.waitFor({ state: 'visible' });
  await field.click();
  await field.evaluate((el, next) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const prototype =
      input instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    const previous = input.value;
    descriptor?.set?.call(input, next);
    // React's value tracker skips events when previous === next.
    const tracker = (
      input as HTMLInputElement & {
        _valueTracker?: { setValue: (v: string) => void };
      }
    )._valueTracker;
    tracker?.setValue(previous);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await expect(field).toHaveValue(value);
  await field.evaluate((el) => (el as HTMLInputElement).blur());
  // Allow onBlur persistence to settle (memory adapter is fast; give React a turn).
  await page.waitForTimeout(150);
}

export async function signIn(
  page: Page,
  email = 'e2e@example.com',
  password = 'secret-password',
) {
  await page.goto('/');
  await expect(byTestId(page, 'sign-in-screen')).toBeVisible();
  await typeInto(page, 'sign-in-email', email);
  await typeInto(page, 'sign-in-password', password);
  await byTestId(page, 'sign-in-submit').click();
  await expect(byTestId(page, 'library-screen')).toBeVisible();
}

/** Sign in, create a process, and set its title. Leaves you on the process screen. */
export async function createNamedProcess(page: Page, title: string) {
  await signIn(page);
  await expect(byTestId(page, 'library-empty')).toBeVisible();
  await byTestId(page, 'library-new-process').click();
  await expect(byTestId(page, 'process-screen')).toBeVisible();
  await typeInto(page, 'process-title', title);
  await expect(byTestId(page, 'process-title')).toHaveValue(title);
}
