import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import VariantBox from './VariantBox.vue';
import { addToCart } from '../api/cart';
import { VARIANT_IMAGE } from '../lib/variant-events';

vi.mock('../api/cart', () => ({ addToCart: vi.fn() }));
const mockAdd = vi.mocked(addToCart);

const variants = [
  {
    id: 1,
    code: null,
    price: '179.00',
    old_price: null,
    in_stock: true,
    value_ids: [10],
    image_url: '/bej.webp',
  },
  {
    id: 2,
    code: null,
    price: '249.00',
    old_price: null,
    in_stock: false,
    value_ids: [20],
    image_url: null,
  },
];
const variationAttributes = [
  {
    attribute_id: 1,
    code: 'color',
    name: 'Culoare',
    values: [
      { value_id: 10, value: 'Bej' },
      { value_id: 20, value: 'Gri' },
    ],
  },
];

function make() {
  return mount(VariantBox, {
    props: {
      productId: 7,
      variants,
      variationAttributes,
      priceMin: '179.00',
      priceMax: '249.00',
      lang: 'ru',
    },
  });
}

function optionButton(w: ReturnType<typeof mount>, text: string) {
  return w.findAll('button').find((b) => b.text() === text)!;
}
function cta(w: ReturnType<typeof mount>) {
  return w
    .findAll('button')
    .find((b) => /корзину|характеристики|наличии|Добавлено|…/.test(b.text()))!;
}

beforeEach(() => {
  mockAdd.mockReset();
  vi.useRealTimers();
});

describe('VariantBox', () => {
  it('shows a "from" price and a disabled CTA before a choice', () => {
    const w = make();
    expect(w.text()).toContain('от');
    expect(w.text()).toContain('179');
    const button = cta(w);
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toContain('Выберите характеристики');
  });

  it('picks a variant → exact price, enabled CTA, image event, add call', async () => {
    const seen: (string | null)[] = [];
    const onImg = (e: Event) =>
      seen.push((e as CustomEvent<{ url: string | null }>).detail.url);
    window.addEventListener(VARIANT_IMAGE, onImg);
    mockAdd.mockResolvedValue(undefined as never);

    const w = make();
    await optionButton(w, 'Bej').trigger('click');

    expect(w.text()).not.toContain('от');
    expect(w.text()).toContain('179');
    expect(seen).toContain('/bej.webp');

    const button = cta(w);
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    await flushPromises();
    expect(mockAdd).toHaveBeenCalledWith(7, 1, 'ru', 1);

    window.removeEventListener(VARIANT_IMAGE, onImg);
  });

  it('an out-of-stock variant disables the CTA and updates the price', async () => {
    const w = make();
    await optionButton(w, 'Gri').trigger('click');
    expect(w.text()).toContain('249');
    const button = cta(w);
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toContain('Нет в наличии');
    await button.trigger('click');
    await flushPromises();
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
