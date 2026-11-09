import { defineConfig, devices } from '@playwright/test';

/** Old-vs-new visual comparison (see compare.spec.ts). Not part of CI. */
export default defineConfig({
  testDir: '.',
  testMatch: /compare\.spec\.ts/,
  timeout: 180_000,
  workers: 2,
  reporter: 'list',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
