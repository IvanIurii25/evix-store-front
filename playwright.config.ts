import { defineConfig } from '@playwright/test';

// E2E config. Browsers install on demand: `pnpm exec playwright install`.
// webServer is wired once there are real pages to drive (F1+).
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
  },
});
