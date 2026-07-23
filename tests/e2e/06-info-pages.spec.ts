import { test, expect } from '@playwright/test';

// Scenario 6 — Manager-managed info/legal pages reachable from the footer
// (delivery, returns, privacy, terms, contacts, about). Read-only.
test.describe('Footer info pages', () => {
  test('footer lists info pages that open and render content', async ({
    page,
  }) => {
    await page.goto('/ro');

    const infoLinks = page.locator('footer a[href*="/info/"]');
    expect(await infoLinks.count()).toBeGreaterThan(0);

    const href = await infoLinks.first().getAttribute('href');
    await page.goto(href!);
    await expect(page).toHaveURL(/\/ro\/info\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
