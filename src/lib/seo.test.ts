import { describe, expect, it } from 'vitest';

import {
  breadcrumbJsonLd,
  organizationJsonLd,
  productJsonLd,
  websiteJsonLd,
} from './seo';
import { LANGS, type Lang } from './i18n';

const ORIGIN = 'https://shop.evix.md';

describe('breadcrumbJsonLd', () => {
  it.each(LANGS)('builds an absolute-URL trail for %s', (lang: Lang) => {
    const ld = breadcrumbJsonLd(
      ORIGIN,
      lang,
      [
        { name: 'Phones', slug: 'phones' },
        { name: 'Android', slug: 'android' },
      ],
      { name: 'Pixel', path: `/${lang}/p/pixel` },
    );
    expect(ld['@type']).toBe('BreadcrumbList');
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    // home + 2 crumbs + current
    expect(items).toHaveLength(4);
    expect(items[0].position).toBe(1);
    expect(items[0].name).toBe('evix-store');
    expect(items[0].item).toBe(`${ORIGIN}/${lang}`);
    expect(items[1].item).toBe(`${ORIGIN}/${lang}/c/phones`);
    expect(items[3].position).toBe(4);
    expect(items[3].item).toBe(`${ORIGIN}/${lang}/p/pixel`);
  });

  it('handles an empty crumb trail (home + current only)', () => {
    const ld = breadcrumbJsonLd(ORIGIN, 'ro', [], {
      name: 'Search',
      path: '/ro/search',
    });
    const items = ld.itemListElement as unknown[];
    expect(items).toHaveLength(2);
  });
});

describe('productJsonLd', () => {
  const base = {
    name: 'Camera 4K',
    code: 'CAM-4K',
    price: 1990,
    in_stock: true,
  };

  it('includes description, images and an InStock offer when present', () => {
    const ld = productJsonLd(ORIGIN, '/ro/p/cam', {
      ...base,
      description: 'A camera',
      media: [{ url: '/media/a.jpg' }, { url: '/media/b.jpg' }],
    });
    expect(ld['@type']).toBe('Product');
    expect(ld.sku).toBe('CAM-4K');
    expect(ld.description).toBe('A camera');
    expect(ld.image).toEqual([
      `${ORIGIN}/media/a.jpg`,
      `${ORIGIN}/media/b.jpg`,
    ]);
    const offer = ld.offers as Record<string, unknown>;
    expect(offer.url).toBe(`${ORIGIN}/ro/p/cam`);
    expect(offer.priceCurrency).toBe('MDL');
    expect(offer.price).toBe('1990');
    expect(offer.availability).toBe('https://schema.org/InStock');
  });

  it('falls back to seo_description and omits image when no media', () => {
    const ld = productJsonLd(ORIGIN, '/ru/p/cam', {
      ...base,
      in_stock: false,
      price: '49.99',
      description: null,
      seo_description: 'SEO copy',
      media: null,
    });
    expect(ld.description).toBe('SEO copy');
    expect(ld.image).toBeUndefined();
    const offer = ld.offers as Record<string, unknown>;
    expect(offer.price).toBe('49.99');
    expect(offer.availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits description entirely when both are absent', () => {
    const ld = productJsonLd(ORIGIN, '/ro/p/cam', base);
    expect(ld.description).toBeUndefined();
    expect(ld.image).toBeUndefined();
  });
});

describe('organizationJsonLd', () => {
  it('emits brand identity with an absolute logo URL', () => {
    const ld = organizationJsonLd(ORIGIN);
    expect(ld['@type']).toBe('Organization');
    expect(ld.url).toBe(ORIGIN);
    expect(ld.logo).toBe(`${ORIGIN}/favicon.svg`);
  });
});

describe('websiteJsonLd', () => {
  it.each(LANGS)('builds a SearchAction with un-encoded placeholder for %s', (lang: Lang) => {
    const ld = websiteJsonLd(ORIGIN, lang);
    expect(ld['@type']).toBe('WebSite');
    expect(ld.inLanguage).toBe(lang);
    const action = ld.potentialAction as Record<string, unknown>;
    const target = action.target as Record<string, unknown>;
    expect(target.urlTemplate).toBe(
      `${ORIGIN}/${lang}/search?q={search_term_string}`,
    );
    expect(action['query-input']).toBe('required name=search_term_string');
  });
});
