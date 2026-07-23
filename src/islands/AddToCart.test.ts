import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AddToCart from './AddToCart.vue';
import { addToCart } from '../api/cart';
import { CART_CHANGED } from '../lib/cart-events';

vi.mock('../api/cart', () => ({ addToCart: vi.fn() }));

const mockAdd = vi.mocked(addToCart);

beforeEach(() => {
  mockAdd.mockReset();
  vi.useRealTimers();
});

function ctaButton(w: ReturnType<typeof mount>) {
  return w.findAll('button').find((b) => b.attributes('disabled') !== undefined || /корзину|Добавлено|Нет в наличии|…/.test(b.text()))!;
}

describe('AddToCart', () => {
  it('increments and decrements the quantity (not below 1)', async () => {
    const w = mount(AddToCart, { props: { productId: 7, inStock: true } });
    const [minus, plus] = w.findAll('button');
    expect(w.find('.w-8').text()).toBe('1');
    await plus.trigger('click');
    await plus.trigger('click');
    expect(w.find('.w-8').text()).toBe('3');
    await minus.trigger('click');
    expect(w.find('.w-8').text()).toBe('2');
    await minus.trigger('click');
    await minus.trigger('click'); // clamps at 1
    expect(w.find('.w-8').text()).toBe('1');
  });

  it('adds to cart, notifies, shows done, then resets to idle', async () => {
    vi.useFakeTimers();
    mockAdd.mockResolvedValue(undefined as never);
    const changed = vi.fn();
    window.addEventListener(CART_CHANGED, changed);

    const w = mount(AddToCart, { props: { productId: 7, inStock: true } });
    await w.findAll('button')[1].trigger('click'); // qty -> 2
    await ctaButton(w).trigger('click');
    await flushPromises();

    expect(mockAdd).toHaveBeenCalledWith(7, 2);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(w.text()).toContain('Добавлено ✓');

    vi.advanceTimersByTime(2000);
    await flushPromises();
    expect(w.text()).toContain('В корзину');
    window.removeEventListener(CART_CHANGED, changed);
  });

  it('shows an error message when the API call fails', async () => {
    mockAdd.mockRejectedValue(new Error('boom'));
    const w = mount(AddToCart, { props: { productId: 7, inStock: true } });
    await ctaButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось добавить в корзину');
  });

  it('does nothing and stays disabled when out of stock', async () => {
    const w = mount(AddToCart, { props: { productId: 7, inStock: false } });
    const cta = ctaButton(w);
    expect(cta.attributes('disabled')).toBeDefined();
    expect(cta.text()).toContain('Нет в наличии');
    await cta.trigger('click');
    await flushPromises();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('ignores a second click while a request is in flight', async () => {
    let resolve!: () => void;
    mockAdd.mockReturnValue(new Promise<void>((r) => (resolve = r)) as never);
    const w = mount(AddToCart, { props: { productId: 7, inStock: true } });
    const cta = ctaButton(w);
    await cta.trigger('click');
    expect(w.text()).toContain('…');
    await cta.trigger('click'); // second click while loading — no-op
    resolve();
    await flushPromises();
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });
});
