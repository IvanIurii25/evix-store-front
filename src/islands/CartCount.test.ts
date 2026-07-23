import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import CartCount from './CartCount.vue';
import { getCart } from '../api/cart';
import { CART_CHANGED } from '../lib/cart-events';

vi.mock('../api/cart', () => ({ getCart: vi.fn() }));

const mockGetCart = vi.mocked(getCart);

// Each island registers a window listener in onMounted; unmount after every
// test so leftover instances don't answer the next test's cart:changed event.
const mounted: VueWrapper[] = [];
function make() {
  const w = mount(CartCount);
  mounted.push(w);
  return w;
}

beforeEach(() => {
  mockGetCart.mockReset();
});

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount();
});

describe('CartCount', () => {
  it('hides the badge when the cart is empty', async () => {
    mockGetCart.mockResolvedValue({ items: [], subtotal: '0', item_count: 0 });
    const w = make();
    await flushPromises();
    expect(w.find('span').exists()).toBe(false);
  });

  it('renders the item count when the cart has items', async () => {
    mockGetCart.mockResolvedValue({ items: [], subtotal: '0', item_count: 3 });
    const w = make();
    await flushPromises();
    expect(w.find('span').text()).toBe('3');
  });

  it('falls back to 0 when item_count is missing', async () => {
    mockGetCart.mockResolvedValue({ items: [], subtotal: '0' } as never);
    const w = make();
    await flushPromises();
    expect(w.find('span').exists()).toBe(false);
  });

  it('shows 0 (hidden) when getCart rejects', async () => {
    mockGetCart.mockRejectedValue(new Error('network'));
    const w = make();
    await flushPromises();
    expect(w.find('span').exists()).toBe(false);
  });

  it('refreshes when a cart:changed event fires', async () => {
    mockGetCart.mockResolvedValueOnce({ items: [], subtotal: '0', item_count: 1 });
    const w = make();
    await flushPromises();
    expect(w.find('span').text()).toBe('1');

    mockGetCart.mockResolvedValueOnce({ items: [], subtotal: '0', item_count: 5 });
    window.dispatchEvent(new Event(CART_CHANGED));
    await flushPromises();
    expect(w.find('span').text()).toBe('5');
  });

  it('stops listening after unmount', async () => {
    mockGetCart.mockResolvedValue({ items: [], subtotal: '0', item_count: 1 });
    const w = make();
    await flushPromises();
    w.unmount();
    mockGetCart.mockClear();
    window.dispatchEvent(new Event(CART_CHANGED));
    await flushPromises();
    expect(mockGetCart).not.toHaveBeenCalled();
  });
});
