import { test, expect } from '@playwright/test';
import { productLinks } from './helpers';

// Scenario 5 — SEO/meta correctness: title/description/canonical/OpenGraph,
// structured data (JSON-LD), the pre-launch noindex guard, and sitemap/robots.
test.describe('SEO & meta', () => {
  test('home has well-formed title, description, canonical and OpenGraph', async ({
    page,
  }) => {
    await page.goto('/ro');

    expect((await page.title()).trim().length).toBeGreaterThan(0);

    const desc = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(desc?.trim().length ?? 0).toBeGreaterThan(0);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toMatch(/^https:\/\/[^/]+\/ro/);

    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      'content',
      'evix',
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      'content',
      'website',
    );
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle?.length ?? 0).toBeGreaterThan(0);
  });

  test('a product page emits Product + Breadcrumb JSON-LD', async ({
    page,
  }) => {
    await page.goto('/ro');
    const href = await productLinks(page).first().getAttribute('href');
    await page.goto(href!);

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const types = blocks.map((b) => {
      try {
        return (JSON.parse(b) as { '@type'?: string })['@type'];
      } catch {
        return undefined;
      }
    });
    expect(types).toContain('Product');
    expect(types).toContain('BreadcrumbList');
  });

  test('sitemap and robots.txt are reachable', async ({ page }) => {
    const sitemap = await page.request.get('/sitemap-ro.xml');
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toMatch(/<urlset|<loc>/);

    const robots = await page.request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect((await robots.text()).length).toBeGreaterThan(0);
  });

  // Pre-launch guard: the store is intentionally kept out of search indexes
  // (SITE_NOINDEX=true). At launch this flag flips — update/remove this check then.
  test('pre-launch: pages carry a noindex robots meta', async ({ page }) => {
    await page.goto('/ro');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  });
});
