import { test, expect } from '@playwright/test';
import { productLinks, deriveSearchTerm } from './helpers';

// Scenario 2 — Search: instant dropdown + results page + empty state.
test.describe('Search', () => {
  test('typing a known term shows instant-search hits', async ({ page }) => {
    const term = await deriveSearchTerm(page);

    const box = page.getByRole('searchbox');
    // Type the full derived word so FTS returns hits (a short prefix may not
    // match); pressSequentially mimics real typing to trigger the debounce.
    await box.pressSequentially(term, { delay: 30 });
    // Debounced dropdown (250ms) renders product links inside the search form.
    const hit = page.locator('form a[href*="/p/"]').first();
    await expect(hit).toBeVisible({ timeout: 8000 });
  });

  test('results page returns products for a known term', async ({ page }) => {
    const term = await deriveSearchTerm(page);

    await page.goto(`/ro/search?q=${encodeURIComponent(term)}`);
    await expect(page).toHaveURL(/\/ro\/search/);
    await expect(productLinks(page).first()).toBeVisible();
  });

  test('nonsense query yields no product results', async ({ page }) => {
    await page.goto('/ro/search?q=zzzqxwvunlikelyterm42');
    await expect(page).toHaveURL(/\/ro\/search/);
    // Empty-state copy is localized; asserting zero product links is robust.
    await expect(productLinks(page)).toHaveCount(0);
  });
});
