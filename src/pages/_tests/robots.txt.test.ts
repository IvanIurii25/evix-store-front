import { describe, it, expect, afterEach } from 'vitest';
import type { APIContext } from 'astro';

import { GET } from '../robots.txt.ts';

function context(site: URL | undefined): APIContext {
  return {
    request: new Request('https://origin.example/robots.txt'),
    site,
  } as unknown as APIContext;
}

describe('GET /robots.txt', () => {
  const original = process.env.SITE_NOINDEX;

  afterEach(() => {
    if (original === undefined) delete process.env.SITE_NOINDEX;
    else process.env.SITE_NOINDEX = original;
  });

  it('allows indexing and lists per-locale sitemaps by default', async () => {
    delete process.env.SITE_NOINDEX;
    const res = await GET(context(new URL('https://shop.evix.md')));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /*/cart');
    expect(body).toContain('Disallow: /*/checkout');
    expect(body).toContain('Disallow: /*/account');
    expect(body).toContain('Disallow: /*/auth');
    expect(body).toContain('Sitemap: https://shop.evix.md/sitemap-ro.xml');
    expect(body).toContain('Sitemap: https://shop.evix.md/sitemap-ru.xml');
  });

  it('blocks all crawling when SITE_NOINDEX=true', async () => {
    process.env.SITE_NOINDEX = 'true';
    const res = await GET(context(new URL('https://shop.evix.md')));
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
    expect(body).not.toContain('Allow: /');
  });

  it('falls back to the request origin when site is undefined', async () => {
    delete process.env.SITE_NOINDEX;
    const res = await GET(context(undefined));
    const body = await res.text();
    expect(body).toContain('Sitemap: https://origin.example/sitemap-ro.xml');
  });
});
