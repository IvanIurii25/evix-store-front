// Cross-island variant sync: the VariantBox dispatches the chosen variant's
// image url on the window; ProductGallery listens and swaps the main image. A
// null url means "no variant image" → the gallery falls back to its default.
export const VARIANT_IMAGE = 'variant:image';

export function notifyVariantImage(url: string | null): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VARIANT_IMAGE, { detail: { url } }));
  }
}
