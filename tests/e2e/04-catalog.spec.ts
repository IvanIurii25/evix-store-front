import { test, expect } from '@playwright/test';
import { categoryLinks, productLinks } from './helpers';

// Scenario 4 — Category controls: sort (writes URL state) and "load more"
// cursor pagination. Read-only: no data is mutated, only navigation/query state.
test.describe('Catalog controls', () => {
  async function openFirstCategory(page: import('@playwright/test').Page) {
    await page.goto('/ro');
    const href = await categoryLinks(page).first().getAttribute('href');
    await page.goto(href!);
    await expect(page).toHaveURL(/\/ro\/c\//);
    await expect(productLinks(page).first()).toBeVisible();
  }

  test('changing sort updates the URL query and keeps the grid', async ({
    page,
  }) => {
    await openFirstCategory(page);

    // The sort <select> writes the choice into the URL (history.replaceState).
    await page.locator('main select').first().selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(productLinks(page).first()).toBeVisible();
  });

  test('"load more" appends more products when a next page exists', async ({
    page,
  }) => {
    await openFirstCategory(page);

    const loadMore = page.getByRole('button', { name: /Показать ещё/ });
    if (!(await loadMore.isVisible().catch(() => false))) {
      test.skip(true, 'category fits on a single page — no pagination to test');
    }
    const before = await productLinks(page).count();
    await loadMore.click();
    await expect.poll(() => productLinks(page).count()).toBeGreaterThan(before);
  });
});
