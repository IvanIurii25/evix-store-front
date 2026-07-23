import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCart = vi.fn();
const updateItem = vi.fn();
const removeItem = vi.fn();

vi.mock('../api/cart', () => ({
  getCart: (...a: unknown[]) => getCart(...a),
  updateItem: (...a: unknown[]) => updateItem(...a),
  removeItem: (...a: unknown[]) => removeItem(...a),
}));

const notifyCartChanged = vi.fn();
vi.mock('../lib/cart-events', () => ({
  notifyCartChanged: () => notifyCartChanged(),
}));

import Cart from './Cart.vue';

const EMPTY = { items: [], subtotal: '0', item_count: 0 };
const POPULATED = {
  items: [
    {
      product_id: 7,
      name: 'Видеорегистратор',
      price: '499',
      qty: 2,
      line_total: '998',
    },
  ],
  subtotal: '998',
  item_count: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Cart', () => {
  it('shows the loading state before the fetch resolves, then the empty state', async () => {
    let resolve!: (v: typeof EMPTY) => void;
    getCart.mockReturnValue(new Promise((r) => (resolve = r)));
    const wrapper = mount(Cart, { props: { lang: 'ru' } });

    // onMounted fired but getCart is still pending → loading text.
    expect(wrapper.text()).toContain('Загрузка…');

    resolve(EMPTY);
    await flushPromises();

    expect(getCart).toHaveBeenCalledWith('ru');
    expect(wrapper.text()).toContain('Корзина пуста.');
    // Empty state links back to the catalog for the given locale.
    expect(wrapper.find('a').attributes('href')).toBe('/ru');
  });

  it('renders line items with formatted prices when the cart is populated', async () => {
    getCart.mockResolvedValue(POPULATED);
    const wrapper = mount(Cart, { props: { lang: 'ro' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Видеорегистратор');
    expect(wrapper.text()).toContain('2'); // qty
    // Checkout CTA link uses the locale path.
    const cta = wrapper.findAll('a').find((a) => a.attributes('href') === '/ro/checkout');
    expect(cta).toBeTruthy();
  });

  it('increments quantity via the + button, reloads, and notifies', async () => {
    getCart.mockResolvedValueOnce(POPULATED).mockResolvedValueOnce(POPULATED);
    updateItem.mockResolvedValue(undefined);
    const wrapper = mount(Cart, { props: { lang: 'ru' } });
    await flushPromises();

    const plus = wrapper.findAll('button').find((b) => b.text() === '+')!;
    await plus.trigger('click');
    await flushPromises();

    expect(updateItem).toHaveBeenCalledWith(7, 3);
    expect(removeItem).not.toHaveBeenCalled();
    expect(notifyCartChanged).toHaveBeenCalledTimes(1);
  });

  it('removes the item when decrementing below 1', async () => {
    const single = {
      items: [{ product_id: 7, name: 'X', price: '10', qty: 1, line_total: '10' }],
      subtotal: '10',
      item_count: 1,
    };
    getCart.mockResolvedValueOnce(single).mockResolvedValueOnce(EMPTY);
    removeItem.mockResolvedValue(undefined);
    const wrapper = mount(Cart, { props: { lang: 'ru' } });
    await flushPromises();

    const minus = wrapper.findAll('button').find((b) => b.text() === '−')!;
    await minus.trigger('click');
    await flushPromises();

    expect(removeItem).toHaveBeenCalledWith(7);
    expect(updateItem).not.toHaveBeenCalled();
    expect(notifyCartChanged).toHaveBeenCalled();
  });

  it('removes the item via the ✕ button', async () => {
    getCart.mockResolvedValueOnce(POPULATED).mockResolvedValueOnce(EMPTY);
    removeItem.mockResolvedValue(undefined);
    const wrapper = mount(Cart, { props: { lang: 'ru' } });
    await flushPromises();

    const del = wrapper.findAll('button').find((b) => b.text() === '✕')!;
    await del.trigger('click');
    await flushPromises();

    expect(removeItem).toHaveBeenCalledWith(7);
    expect(notifyCartChanged).toHaveBeenCalled();
  });

  it('ignores a second action while busy (guard)', async () => {
    getCart.mockResolvedValueOnce(POPULATED);
    // Keep the first updateItem pending so busy stays true.
    let release!: () => void;
    updateItem.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
    const wrapper = mount(Cart, { props: { lang: 'ru' } });
    await flushPromises();

    const plus = wrapper.findAll('button').find((b) => b.text() === '+')!;
    await plus.trigger('click'); // busy = true, updateItem pending
    await plus.trigger('click'); // guarded out
    expect(updateItem).toHaveBeenCalledTimes(1);

    release();
    await flushPromises();
  });

  it('guards remove() while busy', async () => {
    getCart.mockResolvedValueOnce(POPULATED);
    let release!: () => void;
    removeItem.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
    const wrapper = mount(Cart, { props: { lang: 'ru' } });
    await flushPromises();

    const del = wrapper.findAll('button').find((b) => b.text() === '✕')!;
    await del.trigger('click');
    await del.trigger('click');
    expect(removeItem).toHaveBeenCalledTimes(1);

    release();
    await flushPromises();
  });
});
