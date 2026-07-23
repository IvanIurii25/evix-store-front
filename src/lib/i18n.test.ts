import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LANGS,
  hreflangAlternates,
  isLang,
  langFromPath,
  localePath,
  otherLang,
  type Lang,
} from './i18n';

describe('LANGS / DEFAULT_LOCALE', () => {
  it('exposes both storefront locales with ro as default', () => {
    expect(LANGS).toEqual(['ro', 'ru']);
    expect(DEFAULT_LOCALE).toBe('ro');
  });
});

describe('isLang', () => {
  it('accepts the two known locales', () => {
    expect(isLang('ro')).toBe(true);
    expect(isLang('ru')).toBe(true);
  });

  it('rejects unknown / undefined segments', () => {
    expect(isLang('en')).toBe(false);
    expect(isLang('')).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

describe('otherLang', () => {
  it('swaps between the two locales', () => {
    expect(otherLang('ro')).toBe('ru');
    expect(otherLang('ru')).toBe('ro');
  });
});

describe('localePath', () => {
  it('returns just the locale root for an empty path', () => {
    expect(localePath('ro')).toBe('/ro');
    expect(localePath('ru', '')).toBe('/ru');
  });

  it('strips leading slashes and prefixes the locale', () => {
    expect(localePath('ru', 'search')).toBe('/ru/search');
    expect(localePath('ro', '/c/phones')).toBe('/ro/c/phones');
    expect(localePath('ro', '///c/phones')).toBe('/ro/c/phones');
  });
});

describe('langFromPath', () => {
  it('reads the first segment when it is a locale', () => {
    expect(langFromPath('/ru/search')).toBe('ru');
    expect(langFromPath('/ro')).toBe('ro');
  });

  it('falls back to the default locale for non-locale / empty paths', () => {
    expect(langFromPath('/admin/orders')).toBe(DEFAULT_LOCALE);
    expect(langFromPath('/')).toBe(DEFAULT_LOCALE);
    expect(langFromPath('')).toBe(DEFAULT_LOCALE);
  });
});

describe('hreflangAlternates', () => {
  it('emits one alternate per locale plus x-default → default locale', () => {
    const byLang = (l: Lang) => `/${l}/foo`;
    const alts = hreflangAlternates(byLang);
    expect(alts).toEqual([
      { lang: 'ro', path: '/ro/foo' },
      { lang: 'ru', path: '/ru/foo' },
      { lang: 'x-default', path: '/ro/foo' },
    ]);
  });
});
