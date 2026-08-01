import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';

// The sitemap endpoint pulls a flat feed from the catalog API and the footer
// pages from the site API, then renders a per-locale <urlset>. We mock both API
// modules so we can assert the XML structure (loc / lastmod / hreflang) for a
// requested lang without a live backend.

const getSitemap = vi.fn();
const loadFooterPages = vi.fn();

vi.mock('../../api/catalog', () => ({
  getSitemap: () => getSitemap(),
}));
vi.mock('../../api/site', () => ({
  loadFooterPages: (lang: string) => loadFooterPages(lang),
}));

async function loadRoute() {
  return import('../sitemap-[lang].xml.ts');
}

function context(lang: string | undefined): APIContext {
  return {
    params: { lang },
    request: new Request('https://shop.evix.md/sitemap-ru.xml'),
    site: new URL('https://shop.evix.md'),
  } as unknown as APIContext;
}

const SITEMAP = {
  categories: [
    {
      updated_at: '2026-05-01T10:00:00Z',
      slugs: [
        { lang: 'ru', slug: 'avto-ru' },
        { lang: 'ro', slug: 'auto-ro' },
      ],
    },
    // Category without a slug in the requested lang -> skipped for that locale.
    { updated_at: null, slugs: [{ lang: 'ro', slug: 'only-ro' }] },
  ],
  products: [
    {
      updated_at: '2026-06-15T12:00:00Z',
      slugs: [
        { lang: 'ru', slug: 'lampa-ru' },
        { lang: 'ro', slug: 'lampa-ro' },
      ],
    },
  ],
};

describe('GET /sitemap-[lang].xml', () => {
  beforeEach(() => {
    vi.resetModules();
    getSitemap.mockReset();
    loadFooterPages.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 for an unknown lang without calling the API', async () => {
    const { GET } = await loadRoute();
    const res = await GET(context('en'));
    expect(res.status).toBe(404);
    expect(getSitemap).not.toHaveBeenCalled();
  });

  it('renders a valid ru urlset with loc / lastmod / hreflang alternates', async () => {
    getSitemap.mockResolvedValue(SITEMAP);
    loadFooterPages.mockResolvedValue([{ slug: 'about' }]);
    const { GET } = await loadRoute();

    const res = await GET(context('ru'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/xml; charset=utf-8',
    );
    const xml = await res.text();

    // Well-formed envelope.
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset');
    expect(xml.trim().endsWith('</urlset>')).toBe(true);

    // Home for the requested locale + its alternates + x-default.
    expect(xml).toContain('<loc>https://shop.evix.md/ru</loc>');
    expect(xml).toContain(
      'hreflang="x-default" href="https://shop.evix.md/ro"',
    );

    // Catalog hub: a static page in every locale, so it alternates like home.
    expect(xml).toContain('<loc>https://shop.evix.md/ru/c</loc>');
    expect(xml).toContain(
      'hreflang="x-default" href="https://shop.evix.md/ro/c"',
    );

    // Category present in ru, with lastmod truncated to a date.
    expect(xml).toContain('<loc>https://shop.evix.md/ru/c/avto-ru</loc>');
    expect(xml).toContain('<lastmod>2026-05-01</lastmod>');
    expect(xml).toContain(
      'hreflang="ru" href="https://shop.evix.md/ru/c/avto-ru"',
    );
    expect(xml).toContain(
      'hreflang="ro" href="https://shop.evix.md/ro/c/auto-ro"',
    );

    // Product present in ru.
    expect(xml).toContain('<loc>https://shop.evix.md/ru/p/lampa-ru</loc>');

    // Footer content page block alternates to every locale.
    expect(xml).toContain('<loc>https://shop.evix.md/ru/info/about</loc>');
    expect(xml).toContain(
      'hreflang="ro" href="https://shop.evix.md/ro/info/about"',
    );

    // The ro-only category has no ru slug -> its ru urlBlock is dropped.
    expect(xml).not.toContain('/ru/c/only-ro');
    expect(loadFooterPages).toHaveBeenCalledWith('ru');
  });

  it('omits lastmod when updated_at is missing and handles empty feeds', async () => {
    getSitemap.mockResolvedValue({ categories: null, products: undefined });
    loadFooterPages.mockResolvedValue([]);
    const { GET } = await loadRoute();

    const res = await GET(context('ro'));
    const xml = await res.text();
    // Only the home url block; no category/product/info entries.
    expect(xml).toContain('<loc>https://shop.evix.md/ro</loc>');
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('/c/');
    expect(xml).not.toContain('/p/');
  });

  it('tolerates entries with missing/foreign slug arrays', async () => {
    getSitemap.mockResolvedValue({
      categories: [
        // slugs undefined -> the `?? []` guards must not throw.
        { updated_at: '2026-01-02T00:00:00Z' },
        // ru slug present but no ro (default) slug -> x-default alternate omitted.
        {
          updated_at: null,
          slugs: [
            { lang: 'ru', slug: 'ru-only' },
            // A non-locale code -> filtered out of alternates by isLang.
            { lang: 'de', slug: 'de-junk' },
          ],
        },
      ],
      products: [],
    });
    loadFooterPages.mockResolvedValue([]);
    const { GET } = await loadRoute();

    const res = await GET(context('ru'));
    const xml = await res.text();
    // The ru-only category is emitted, with a ru alternate...
    expect(xml).toContain('<loc>https://shop.evix.md/ru/c/ru-only</loc>');
    expect(xml).toContain(
      'hreflang="ru" href="https://shop.evix.md/ru/c/ru-only"',
    );
    // ...but no x-default (no ro slug) and no foreign-locale alternate.
    expect(xml).not.toContain('/c/de-junk');
    expect(xml).not.toContain(
      'hreflang="x-default" href="https://shop.evix.md/ro/c/ru-only"',
    );
  });

  it('falls back to the request origin when site is undefined', async () => {
    getSitemap.mockResolvedValue({ categories: [], products: [] });
    loadFooterPages.mockResolvedValue([]);
    const { GET } = await loadRoute();

    const ctx = {
      params: { lang: 'ru' },
      request: new Request('https://origin.example/sitemap-ru.xml'),
      site: undefined,
    } as unknown as APIContext;

    const res = await GET(ctx);
    const xml = await res.text();
    expect(xml).toContain('<loc>https://origin.example/ru</loc>');
  });
});
