import type { Page } from '@playwright/test';

// Shared helpers for the read-only storefront e2e suite.

/** First in-catalog product-detail link inside <main> (skips header/footer). */
export function productLinks(page: Page) {
  return page.locator('main a[href*="/p/"]');
}

/** First category link inside <main>. */
export function categoryLinks(page: Page) {
  return page.locator('main a[href*="/c/"]');
}

/**
 * Derive a real search term from a live product name on the home page, so the
 * search scenario always queries something the catalog actually contains
 * (content is dynamic, so hard-coding a term would be brittle).
 */
export async function deriveSearchTerm(page: Page): Promise<string> {
  await page.goto('/ro');
  const first = productLinks(page).first();
  await first.waitFor({ state: 'visible' });
  const text = (await first.innerText()).trim();
  // Pick the longest alphabetic word (≥4 chars) — avoids prices/units/badges.
  const word = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ''))
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  return word ?? 'a';
}
