// Cross-island cart sync: AddToCart / Cart dispatch this on the window; the
// header CartCount badge listens and refetches the count.
export const CART_CHANGED = 'cart:changed';

export function notifyCartChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CART_CHANGED));
  }
}
