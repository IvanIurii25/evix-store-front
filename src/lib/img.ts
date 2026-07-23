// Responsive-image helper. The backend stores, alongside every original media
// object `media/<name>.<ext>`, a set of downscaled WebP variants named
// `media/<name>_<width>.webp` (see the backend image pipeline: backfill script +
// upload converter). This builds the WebP `srcset` from an original URL so a
// `<picture>` can serve the right-sized WebP to modern browsers while the
// `<img>` keeps the original as a fallback for the rare non-WebP client.

export const RESPONSIVE_WIDTHS = [200, 400, 800, 1200] as const;

// Strip the original extension and append the per-width WebP variant names.
// Returns '' for an empty/missing URL so callers can skip the <source>.
export function webpSrcset(originalUrl: string | null | undefined): string {
  if (!originalUrl) return '';
  const base = originalUrl.replace(/\.[^./]+$/, '');
  return RESPONSIVE_WIDTHS.map((w) => `${base}_${w}.webp ${w}w`).join(', ');
}
