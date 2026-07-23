import { test, expect } from '@playwright/test';
import { productLinks } from './helpers';

// Scenario 3 — Bilingual (ro default ↔ ru): locale redirect, header language
// switch, and hreflang alternates on a product page.
test.describe('i18n / language switch', () => {
  test('root redirects to the default locale (ro)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ro(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  });

  test('switching ro → ru from the header changes locale', async ({ page }) => {
    await page.goto('/ro');
    // Header switcher renders the *other* locale as an <a hreflang="…">.
    await page.locator('header a[hreflang="ru"]').first().click();
    await expect(page).toHaveURL(/\/ru(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('a product page exposes ro + ru hreflang alternates', async ({
    page,
  }) => {
    await page.goto('/ro');
    const href = await productLinks(page).first().getAttribute('href');
    await page.goto(href!);

    await expect(
      page.locator('link[rel="alternate"][hreflang="ro"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="ru"]'),
    ).toHaveCount(1);
  });
});
