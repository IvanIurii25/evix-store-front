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

// --- Indicative installment (PDP "rate de la ~N lei/lună") ------------------ //
// NOT a real BNPL/iutePay integration — a purely estimated trigger line, like
// flystore's visual. `INSTALLMENT_TERM` months and the `INSTALLMENT_THRESHOLD`
// (below which we stay silent, so cheap items don't show it) are the two knobs.
export const INSTALLMENT_TERM = 6;
export const INSTALLMENT_THRESHOLD = 500;

// Estimated monthly payment: ceil(price / term). Rounds UP so the shown figure
// is never optimistically lower than the plain division. Non-positive term or
// non-finite price yields 0 (caller gates on the threshold anyway).
export function installmentMonthly(
  value: string | number,
  term: number = INSTALLMENT_TERM,
): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0 || !(term > 0)) return 0;
  return Math.ceil(n / term);
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

// "N recenzii" / "N отзывов" — localized review counter with correct plural.
// RO: 1 → recenzie, else recenzii. RU: 1 → отзыв, 2–4 → отзыва, else отзывов
// (standard Slavic rule with the 11–14 exception). Mirrors productCount.
export function reviewCount(count: number, lang: Lang): string {
  const n = Math.abs(count);
  if (lang === 'ro') {
    return `${count} ${n === 1 ? 'recenzie' : 'recenzii'}`;
  }
  const mod100 = n % 100;
  const mod10 = n % 10;
  let word: string;
  if (mod100 >= 11 && mod100 <= 14) word = 'отзывов';
  else if (mod10 === 1) word = 'отзыв';
  else if (mod10 >= 2 && mod10 <= 4) word = 'отзыва';
  else word = 'отзывов';
  return `${count} ${word}`;
}

// "N persoane" / "N человек" — localized person counter for the honest PDP
// social-proof badge ("in N people's carts"). RO: 1 → persoană, else persoane.
// RU: 1 → человек, 2–4 → человека, else человек (standard Slavic rule with the
// 11–14 exception). Mirrors productCount's plural logic.
export function personCount(count: number, lang: Lang): string {
  const n = Math.abs(count);
  if (lang === 'ro') {
    return `${count} ${n === 1 ? 'persoană' : 'persoane'}`;
  }
  const mod100 = n % 100;
  const mod10 = n % 10;
  let word: string;
  if (mod100 >= 11 && mod100 <= 14) word = 'человек';
  else if (mod10 === 1) word = 'человек';
  else if (mod10 >= 2 && mod10 <= 4) word = 'человека';
  else word = 'человек';
  return `${count} ${word}`;
}
