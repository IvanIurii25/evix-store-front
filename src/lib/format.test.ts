import { describe, expect, it } from 'vitest';

import { price } from './format';

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
