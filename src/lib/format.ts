import type { Lang } from './i18n';

// Price formatting — one fixed currency (MDL), formatted per locale.
const formatter = new Intl.NumberFormat('ro-MD', {
  style: 'currency',
  currency: 'MDL',
  maximumFractionDigits: 0,
});

export function price(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return formatter.format(Number.isFinite(n) ? n : 0);
}

// Discount percentage from the two prices, rounded to a whole number.
// oldPrice = struck-through original, price = current discounted price.
// Returns 0 when there is no positive discount (old_price missing / <= price).
export function discountPercent(
  oldPrice: string | number | null | undefined,
  price: string | number,
): number {
  const original = Number(oldPrice);
  const current = Number(price);
  if (!(original > 0) || !(current >= 0) || current >= original) return 0;
  return Math.round((1 - current / original) * 100);
}

// "N produse" / "N товаров" — localized product counter with correct plural
// form. RO: 1 → produs, else produse. RU: 1 → товар, 2–4 → товара, else товаров
// (the standard Slavic plural rule, minding the 11–14 exception).
export function productCount(count: number, lang: Lang): string {
  const n = Math.abs(count);
  if (lang === 'ro') {
    return `${count} ${n === 1 ? 'produs' : 'produse'}`;
  }
  const mod100 = n % 100;
  const mod10 = n % 10;
  let word: string;
  if (mod100 >= 11 && mod100 <= 14) word = 'товаров';
  else if (mod10 === 1) word = 'товар';
  else if (mod10 >= 2 && mod10 <= 4) word = 'товара';
  else word = 'товаров';
  return `${count} ${word}`;
}
