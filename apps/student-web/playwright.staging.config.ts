import { defineConfig, devices } from '@playwright/test';
import { loadStagingEnvFile, STAGING_SESSION, stagingSiteUrl } from './e2e/staging/target';

loadStagingEnvFile(import.meta.dirname);

export default defineConfig({
  testDir: './e2e/staging',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [[process.env.CI ? 'github' : 'list'], ['html', { open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: stagingSiteUrl(),
    screenshot: 'on',
    video: 'retain-on-failure',
    // a trace would keep the student's session cookies in the report
    trace: 'off',
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
  },
  projects: [
    { name: 'staging-login', testMatch: '**/login.setup.ts' },
    {
      name: 'staging',
      dependencies: ['staging-login'],
      use: { ...devices['Desktop Chrome'], storageState: STAGING_SESSION },
    },
  ],
});
