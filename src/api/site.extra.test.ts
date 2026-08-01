import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// site.test.ts covers the pure resolveSeoMeta helper. This file covers the
// fetch-backed accessors (SEO defaults + footer pages + content page), including
// the process-wide TTL caches, without touching the existing test file.

const BASE = 'http://localhost:58000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(status = 500): Response {
  return jsonResponse({ error: { code: 'E', message: 'x' } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

// A fresh Response per call: the body stream is single-use, so tests that fetch
// more than once (TTL/cache paths) must not share one Response instance.
function stubFactory(make: () => Response) {
  fetchMock = vi.fn(async () => make());
  vi.stubGlobal('fetch', fetchMock);
}

function stub(response: Response) {
  stubFactory(() => response);
}

function url(): string {
  return (fetchMock.mock.calls[0][0] as Request).url;
}

async function load() {
  // Fresh module each test so the module-level caches start empty.
  return import('./site');
}

const SEO = {
  title_ru: 'evix ru',
  title_ro: 'evix ro',
  description_ru: 'desc ru',
  description_ro: 'desc ro',
  title_suffix: ' — evix',
  og_image_url: 'https://x/og.jpg',
};

describe('site api (fetch-backed accessors)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getSeoDefaults returns the backend settings', async () => {
    stub(jsonResponse(SEO));
    const { getSeoDefaults } = await load();
    await expect(getSeoDefaults()).resolves.toEqual(SEO);
    expect(url()).toBe(`${BASE}/api/v1/site/seo`);
  });

  it('getSeoDefaults degrades to the empty SEO block on error', async () => {
    stub(envelope());
    const { getSeoDefaults } = await load();
    const res = await getSeoDefaults();
    expect(res.title_ru).toBe('');
    expect(res.og_image_url).toBe('');
  });

  it('loadSeoDefaults caches a successful fetch within the TTL window', async () => {
    stub(jsonResponse(SEO));
    const { loadSeoDefaults } = await load();

    const first = await loadSeoDefaults(1000);
    expect(first).toEqual(SEO);
    // Second call inside the TTL must be served from cache (no new fetch).
    const second = await loadSeoDefaults(2000);
    expect(second).toEqual(SEO);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loadSeoDefaults re-fetches once the TTL expires', async () => {
    stubFactory(() => jsonResponse(SEO));
    const { loadSeoDefaults } = await load();

    await loadSeoDefaults(0);
    // 6 minutes later (TTL is 5 min) -> cache miss -> second fetch.
    await loadSeoDefaults(6 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loadSeoDefaults does not cache the empty fallback', async () => {
    stubFactory(() => envelope());
    const { loadSeoDefaults } = await load();

    await loadSeoDefaults(0);
    await loadSeoDefaults(1);
    // Both calls hit the network because the empty block is never cached.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loadFooterPages returns pages and caches per-lang', async () => {
    stub(jsonResponse([{ slug: 'about' }]));
    const { loadFooterPages } = await load();

    const res = await loadFooterPages('ru', 0);
    expect(res).toEqual([{ slug: 'about' }]);
    expect(url()).toContain('lang=ru');

    await loadFooterPages('ru', 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  });

  it('loadFooterPages re-fetches after the TTL expires', async () => {
    stubFactory(() => jsonResponse([{ slug: 'about' }]));
    const { loadFooterPages } = await load();
    await loadFooterPages('ru', 0);
    await loadFooterPages('ru', 6 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loadFooterPages returns [] on error and does not cache it', async () => {
    stubFactory(() => envelope());
    const { loadFooterPages } = await load();
    await expect(loadFooterPages('ru', 0)).resolves.toEqual([]);
    await loadFooterPages('ru', 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('getContentPage returns the page on success', async () => {
    stub(jsonResponse({ slug: 'about', title: 'About' }));
    const { getContentPage } = await load();
    await expect(getContentPage('about', 'ru')).resolves.toEqual({
      slug: 'about',
      title: 'About',
    });
    const u = url();
    expect(u).toContain('/api/v1/site/pages/about');
    expect(u).toContain('lang=ru');
  });

  it('getContentPage returns null on error/404', async () => {
    stub(envelope(404));
    const { getContentPage } = await load();
    await expect(getContentPage('missing', 'ru')).resolves.toBeNull();
  });

  it('getSiteConfig returns the backend card flag', async () => {
    stub(jsonResponse({ card_payment_enabled: true }));
    const { getSiteConfig } = await load();
    await expect(getSiteConfig()).resolves.toEqual({
      card_payment_enabled: true,
    });
    expect(url()).toBe(`${BASE}/api/v1/site/config`);
  });

  it('getSiteConfig fails closed (card disabled) on error', async () => {
    stub(envelope());
    const { getSiteConfig } = await load();
    await expect(getSiteConfig()).resolves.toEqual({
      card_payment_enabled: false,
    });
  });
  // --- loadBanners (homepage carousel) --------------------------------------

  const BANNERS = [
    {
      id: 1,
      image_url: 'https://media.evix.md/media/b1.jpg',
      image_mobile_url: null,
      alt: 'Акция',
      title: null,
      subtitle: null,
      cta_label: null,
      link_url: '/ru/c/dom',
    },
  ];

  it('loadBanners returns the live carousel and sends lang', async () => {
    stub(jsonResponse(BANNERS));
    const { loadBanners } = await load();
    await expect(loadBanners('ru', 0)).resolves.toEqual(BANNERS);
    expect(url()).toBe(`${BASE}/api/v1/site/banners?lang=ru`);
  });

  it('loadBanners caches per language within the TTL', async () => {
    stubFactory(() => jsonResponse(BANNERS));
    const { loadBanners } = await load();

    await loadBanners('ru', 1000);
    await loadBanners('ru', 2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A different locale is a different carousel.
    await loadBanners('ro', 2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loadBanners re-fetches once the TTL expires', async () => {
    stubFactory(() => jsonResponse(BANNERS));
    const { loadBanners } = await load();

    await loadBanners('ru', 0);
    await loadBanners('ru', 6 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loadBanners degrades to [] and does not cache the failure', async () => {
    stubFactory(() => envelope());
    const { loadBanners } = await load();

    // The homepage falls back to its static hero, and retries next render
    // instead of staying empty for the whole window.
    await expect(loadBanners('ru', 0)).resolves.toEqual([]);
    await loadBanners('ru', 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
