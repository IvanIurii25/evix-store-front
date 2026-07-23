import { defineConfig, devices } from '@playwright/test';

// End-to-end scenario suite.
//
// Target: the LIVE storefront https://shop.evix.md by default (override with
// E2E_BASE_URL to point at a local `astro dev` on :4321 or a staging URL).
//
// Scope: READ-ONLY customer journeys (browse, search, i18n, SEO, info pages).
// These never place an order, create an account, or touch the admin — so they
// are safe to run against production without polluting real data.
//
// Reporter: Playwright's built-in `html` reporter writes a self-contained report
// to ./playwright-report (open with `pnpm test:e2e:report`). The `list` reporter
// streams progress to the console as it walks each test case.
export default defineConfig({
  testDir: './tests/e2e',
  // Fail the run if someone leaves `test.only` in a committed spec.
  forbidOnly: !!process.env.CI,
  // Prod is a remote origin over the network — retry to absorb transient blips.
  retries: process.env.CI ? 2 : 1,
  // Read-only tests are independent; run them in parallel for speed.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://shop.evix.md',
    // Diagnostics captured only when a test fails/retries — keeps the happy
    // path fast while making failures debuggable from the HTML report.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    // Mobile is the majority of storefront traffic — run the same journeys on a
    // phone viewport so responsive regressions surface too.
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
