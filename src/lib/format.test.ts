import { describe, expect, it } from 'vitest';

import {
  discountPercent,
  installmentMonthly,
  INSTALLMENT_TERM,
  personCount,
  price,
  productCount,
  reviewCount,
} from './format';

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

describe('installmentMonthly', () => {
  it('rounds the monthly payment UP (ceil of price / term)', () => {
    expect(installmentMonthly(6000, 6)).toBe(1000);
    expect(installmentMonthly(6001, 6)).toBe(1001); // 1000.16 -> ceil 1001
    expect(installmentMonthly(500, 6)).toBe(84); // 83.33 -> ceil 84
  });

  it('defaults the term to INSTALLMENT_TERM', () => {
    expect(installmentMonthly(3000)).toBe(
      installmentMonthly(3000, INSTALLMENT_TERM),
    );
    expect(installmentMonthly(1200)).toBe(Math.ceil(1200 / INSTALLMENT_TERM));
  });

  it('parses a numeric string price', () => {
    expect(installmentMonthly('900', 6)).toBe(150);
  });

  it('returns 0 for non-positive / non-finite price or non-positive term', () => {
    expect(installmentMonthly(0, 6)).toBe(0);
    expect(installmentMonthly(-100, 6)).toBe(0);
    expect(installmentMonthly('not-a-number', 6)).toBe(0);
    expect(installmentMonthly(1000, 0)).toBe(0);
    expect(installmentMonthly(1000, -3)).toBe(0);
  });
});

describe('productCount', () => {
  it('uses the RO plural rule (1 → produs, else produse)', () => {
    expect(productCount(1, 'ro')).toBe('1 produs');
    expect(productCount(0, 'ro')).toBe('0 produse');
    expect(productCount(2, 'ro')).toBe('2 produse');
    expect(productCount(5, 'ro')).toBe('5 produse');
    expect(productCount(21, 'ro')).toBe('21 produse');
  });

  it('uses the RU Slavic plural rule (товар / товара / товаров)', () => {
    expect(productCount(1, 'ru')).toBe('1 товар');
    expect(productCount(2, 'ru')).toBe('2 товара');
    expect(productCount(3, 'ru')).toBe('3 товара');
    expect(productCount(4, 'ru')).toBe('4 товара');
    expect(productCount(5, 'ru')).toBe('5 товаров');
    expect(productCount(0, 'ru')).toBe('0 товаров');
    expect(productCount(21, 'ru')).toBe('21 товар');
    expect(productCount(22, 'ru')).toBe('22 товара');
    expect(productCount(25, 'ru')).toBe('25 товаров');
  });

  it('applies the RU 11–14 exception (always товаров)', () => {
    expect(productCount(11, 'ru')).toBe('11 товаров');
    expect(productCount(12, 'ru')).toBe('12 товаров');
    expect(productCount(13, 'ru')).toBe('13 товаров');
    expect(productCount(14, 'ru')).toBe('14 товаров');
    expect(productCount(111, 'ru')).toBe('111 товаров');
    expect(productCount(112, 'ru')).toBe('112 товаров');
  });
});

describe('personCount', () => {
  it('uses the RO plural rule (1 → persoană, else persoane)', () => {
    expect(personCount(1, 'ro')).toBe('1 persoană');
    expect(personCount(3, 'ro')).toBe('3 persoane');
    expect(personCount(5, 'ro')).toBe('5 persoane');
    expect(personCount(21, 'ro')).toBe('21 persoane');
  });

  it('uses the RU Slavic plural rule (человек / человека / человек)', () => {
    expect(personCount(1, 'ru')).toBe('1 человек');
    expect(personCount(2, 'ru')).toBe('2 человека');
    expect(personCount(3, 'ru')).toBe('3 человека');
    expect(personCount(4, 'ru')).toBe('4 человека');
    expect(personCount(5, 'ru')).toBe('5 человек');
    expect(personCount(21, 'ru')).toBe('21 человек');
    expect(personCount(22, 'ru')).toBe('22 человека');
    expect(personCount(25, 'ru')).toBe('25 человек');
  });

  it('applies the RU 11–14 exception (always человек)', () => {
    expect(personCount(11, 'ru')).toBe('11 человек');
    expect(personCount(12, 'ru')).toBe('12 человек');
    expect(personCount(13, 'ru')).toBe('13 человек');
    expect(personCount(14, 'ru')).toBe('14 человек');
  });
});

describe('reviewCount', () => {
  it('formats RO singular vs plural', () => {
    expect(reviewCount(1, 'ro')).toBe('1 recenzie');
    expect(reviewCount(0, 'ro')).toBe('0 recenzii');
    expect(reviewCount(5, 'ro')).toBe('5 recenzii');
  });

  it('applies the RU Slavic plural rule', () => {
    expect(reviewCount(1, 'ru')).toBe('1 отзыв');
    expect(reviewCount(2, 'ru')).toBe('2 отзыва');
    expect(reviewCount(4, 'ru')).toBe('4 отзыва');
    expect(reviewCount(5, 'ru')).toBe('5 отзывов');
    expect(reviewCount(21, 'ru')).toBe('21 отзыв');
    expect(reviewCount(22, 'ru')).toBe('22 отзыва');
  });

  it('applies the RU 11–14 exception (always отзывов)', () => {
    expect(reviewCount(11, 'ru')).toBe('11 отзывов');
    expect(reviewCount(12, 'ru')).toBe('12 отзывов');
    expect(reviewCount(14, 'ru')).toBe('14 отзывов');
  });
});
