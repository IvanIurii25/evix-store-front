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
