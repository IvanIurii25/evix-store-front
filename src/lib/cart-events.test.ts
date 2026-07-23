import { afterEach, describe, expect, it, vi } from 'vitest';

import { CART_CHANGED, notifyCartChanged } from './cart-events';

describe('cart-events', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exposes the shared event name', () => {
    expect(CART_CHANGED).toBe('cart:changed');
  });

  it('dispatches the cart-changed event on the window', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    notifyCartChanged();
    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0][0] as Event;
    expect(evt.type).toBe(CART_CHANGED);
  });

  it('is a no-op when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => notifyCartChanged()).not.toThrow();
  });
});
