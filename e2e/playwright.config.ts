import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_WEB_PORT ?? 8081);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './web',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // npm scripts run from the repo root; Playwright's config dir is e2e/.
    command: `npx expo start --web --port ${port}`,
    cwd: process.cwd(),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    },
  },
});
