import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
/** The app is built against this fake API host; e2e/fixtures.ts answers its requests. */
export const E2E_API = 'http://api.e2e.test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // HTML report with a screenshot of every test (playwright-report/): `npm run e2e:report` locally,
  // the "playwright-report" download on each GitHub Actions run in CI.
  reporter: [[process.env.CI ? 'github' : 'list'], ['html', { open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Runs against a production build. Set E2E_BASE_URL to test a deployed environment instead.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node scripts/clean-tsconfig-includes.mjs && npx next build && npx next start -p ${PORT}`,
        port: PORT,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          // Separate build folder: never overwrite the `.next` of a running `npm run dev`.
          NEXT_DIST_DIR: '.next-e2e',
          NEXT_PUBLIC_ENV: 'staging',
          NEXT_PUBLIC_API_URL: E2E_API,
          NEXT_PUBLIC_PARENT_DOMAIN: 'localhost',
        },
      },
});
