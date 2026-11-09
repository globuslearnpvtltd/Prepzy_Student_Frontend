import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    env: {
      NEXT_PUBLIC_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://api.test',
      NEXT_PUBLIC_PARENT_DOMAIN: 'localhost',
    },
    coverage: {
      provider: 'v8',
      include: ['src/features/**', 'src/shared/**'],
      // analytics only injects third-party scripts in production builds
      exclude: ['**/*.test.*', '**/index.ts', '**/ui.ts', 'src/shared/analytics/**'],
      thresholds: { lines: 70, functions: 70, branches: 65 },
    },
  },
});
