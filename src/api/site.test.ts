import { describe, expect, it } from 'vitest';

import { resolveSeoMeta, type SeoDefaults } from './site';

const FULL: SeoDefaults = {
  title_ru: 'evix — магазин',
  title_ro: 'evix — magazin',
  description_ru: 'Товары для дома и авто',
  description_ro: 'Produse pentru casă și auto',
  title_suffix: ' — evix',
  og_image_url: 'https://media.evix.md/public/og-default.jpg',
};

const EMPTY: SeoDefaults = {
  title_ru: '',
  title_ro: '',
  description_ru: '',
  description_ro: '',
  title_suffix: '',
  og_image_url: '',
};

describe('resolveSeoMeta', () => {
  it('appends the suffix to an inner-page title', () => {
    const meta = resolveSeoMeta(FULL, {
      lang: 'ru',
      title: 'Видеорегистратор 4K',
    });
    expect(meta.title).toBe('Видеорегистратор 4K — evix');
  });

  it('uses the site title as-is on the homepage (no title, no suffix)', () => {
    expect(resolveSeoMeta(FULL, { lang: 'ru' }).title).toBe('evix — магазин');
    expect(resolveSeoMeta(FULL, { lang: 'ro' }).title).toBe('evix — magazin');
  });

  it('picks description by language, falling back to ro for unknown langs', () => {
    expect(resolveSeoMeta(FULL, { lang: 'ru' }).description).toBe(
      'Товары для дома и авто',
    );
    expect(resolveSeoMeta(FULL, { lang: 'en' }).description).toBe(
      'Produse pentru casă și auto',
    );
  });

  it('prefers a page-specific description and OG image over the defaults', () => {
    const meta = resolveSeoMeta(FULL, {
      lang: 'ru',
      description: 'Описание товара',
      ogImage: 'https://media.evix.md/p/123.jpg',
    });
    expect(meta.description).toBe('Описание товара');
    expect(meta.ogImage).toBe('https://media.evix.md/p/123.jpg');
  });

  it('degrades to bare fallbacks when the defaults are unset', () => {
    const meta = resolveSeoMeta(EMPTY, { lang: 'ru' });
    expect(meta.title).toBe('evix-store');
    expect(meta.description).toBe('evix-store storefront');
    expect(meta.ogImage).toBe('');
  });
});
