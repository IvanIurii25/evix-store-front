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
