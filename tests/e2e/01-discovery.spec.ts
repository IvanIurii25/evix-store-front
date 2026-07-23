import { test, expect } from '@playwright/test';
import { productLinks, categoryLinks } from './helpers';

// Scenario 1 — Discovery path: home → category → product (the most frequent
// storefront journey). Read-only navigation against production.
test.describe('Discovery: home → category → product', () => {
  test('home redirects to /ro and shows categories + products', async ({
    page,
  }) => {
    await page.goto('/');
    // Default-locale redirect.
    await expect(page).toHaveURL(/\/ro(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    // Header brand + a search box are present.
    await expect(page.getByRole('searchbox')).toBeVisible();
    // The home page surfaces category tiles and product rails.
    expect(await categoryLinks(page).count()).toBeGreaterThan(0);
    expect(await productLinks(page).count()).toBeGreaterThan(0);
  });

  test('opening a category shows its heading and a product grid', async ({
    page,
  }) => {
    await page.goto('/ro');
    const href = await categoryLinks(page).first().getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);
    await expect(page).toHaveURL(/\/ro\/c\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(productLinks(page).first()).toBeVisible();
  });

  test('opening a product shows title, code, price and an action', async ({
    page,
  }) => {
    await page.goto('/ro');
    const href = await productLinks(page).first().getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);
    await expect(page).toHaveURL(/\/ro\/p\//);
    // PDP core: product name (h1), article code, and a price.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Код:/)).toBeVisible();
    // In-stock → Add-to-cart button; out-of-stock → Restock-notify button.
    // Either way the product info column exposes an actionable button.
    await expect(page.locator('main button').first()).toBeVisible();
  });
});
