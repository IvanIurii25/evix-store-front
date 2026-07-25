import { describe, expect, it } from 'vitest';

import { discountPercent, price } from './format';

describe('price', () => {
  it('formats a numeric MDL amount with no fraction digits', () => {
    const out = price(1500);
    expect(out).toContain('1');
    expect(out).toContain('500');
    expect(out).not.toContain(',00');
    expect(out).not.toContain('.00');
  });

  it('parses a numeric string', () => {
    expect(price('250')).toBe(price(250));
  });

  it('falls back to 0 for non-finite / non-numeric input', () => {
    expect(price('not-a-number')).toBe(price(0));
    expect(price(Number.NaN)).toBe(price(0));
    expect(price(Infinity)).toBe(price(0));
  });
});

describe('discountPercent', () => {
  it('computes the rounded percentage from old_price and price', () => {
    expect(discountPercent(399, 299)).toBe(25); // round(1 - 299/399) = 25
    expect(discountPercent('200', '150')).toBe(25);
    expect(discountPercent(100, 80)).toBe(20);
  });

  it('rounds to a whole number', () => {
    expect(discountPercent(300, 199)).toBe(34); // 33.67 -> 34
  });

  it('returns 0 when old_price is missing', () => {
    expect(discountPercent(null, 100)).toBe(0);
    expect(discountPercent(undefined, 100)).toBe(0);
  });

  it('returns 0 when there is no positive discount (old_price <= price)', () => {
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(100, 120)).toBe(0);
  });

  it('returns 0 for non-positive / non-numeric old_price', () => {
    expect(discountPercent(0, 50)).toBe(0);
    expect(discountPercent('not-a-number', 50)).toBe(0);
  });
});
