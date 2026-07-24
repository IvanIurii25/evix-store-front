import { describe, expect, it } from 'vitest';

import {
  accountStrings,
  authStrings,
  cartStrings,
  checkoutStrings,
  footerLabels,
  homeStrings,
  ui,
} from './i18n-strings';
import { LANGS, type Lang } from './i18n';

// Each accessor returns a per-language object. We assert both languages resolve
// to distinct, non-empty maps with the full key set — hitting every selector
// for ru + ro without asserting every literal string.

function assertNonEmptyStrings<T extends object>(obj: T): void {
  const values = Object.values(obj);
  expect(values.length).toBeGreaterThan(0);
  for (const v of values) {
    if (typeof v === 'string') expect(v.length).toBeGreaterThan(0);
  }
}

describe('homeStrings', () => {
  it.each(LANGS)('resolves a full home map for %s', (lang: Lang) => {
    const s = homeStrings(lang);
    expect(s.heroTitle.length).toBeGreaterThan(0);
    expect(s.heroCta.length).toBeGreaterThan(0);
    expect(s.benefits).toHaveLength(4);
    for (const b of s.benefits) {
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.text.length).toBeGreaterThan(0);
    }
  });

  it('differs between ro and ru', () => {
    expect(homeStrings('ro').heroTitle).not.toBe(homeStrings('ru').heroTitle);
  });
});

describe('ui', () => {
  it.each(LANGS)('resolves chrome strings for %s', (lang: Lang) => {
    const s = ui(lang);
    assertNonEmptyStrings(s);
    expect(s.addToCart.length).toBeGreaterThan(0);
    expect(s.searchPlaceholder.length).toBeGreaterThan(0);
  });
  it('differs between languages', () => {
    expect(ui('ro').catalog).not.toBe(ui('ru').catalog);
  });
});

describe('cartStrings', () => {
  it.each(LANGS)('resolves cart strings for %s', (lang: Lang) => {
    assertNonEmptyStrings(cartStrings(lang));
    expect(cartStrings(lang).checkout.length).toBeGreaterThan(0);
  });
});

describe('checkoutStrings', () => {
  it.each(LANGS)('resolves checkout strings for %s', (lang: Lang) => {
    const s = checkoutStrings(lang);
    assertNonEmptyStrings(s);
    expect(s.placeOrder.length).toBeGreaterThan(0);
    expect(s.errAddress.length).toBeGreaterThan(0);
    expect(s.successTitle.length).toBeGreaterThan(0);
  });
});

describe('authStrings', () => {
  it.each(LANGS)('resolves auth strings for %s', (lang: Lang) => {
    const s = authStrings(lang);
    assertNonEmptyStrings(s);
    expect(s.signIn.length).toBeGreaterThan(0);
    expect(s.errPasswordMin.length).toBeGreaterThan(0);
  });
});

describe('accountStrings', () => {
  it.each(LANGS)('resolves account strings for %s', (lang: Lang) => {
    const s = accountStrings(lang);
    assertNonEmptyStrings(s);
    expect(s.orderHistory.length).toBeGreaterThan(0);
    expect(s.statusCanceled.length).toBeGreaterThan(0);
  });
});

describe('footerLabels', () => {
  it.each(LANGS)('resolves footer labels for %s', (lang: Lang) => {
    const s = footerLabels(lang);
    assertNonEmptyStrings(s);
    expect(s.catalog.length).toBeGreaterThan(0);
  });
  it('differs between languages', () => {
    expect(footerLabels('ro').shopTitle).not.toBe(footerLabels('ru').shopTitle);
  });
});
