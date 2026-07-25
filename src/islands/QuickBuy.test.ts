import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import QuickBuy from './QuickBuy.vue';
import { quickBuy } from '../api/checkout';

vi.mock('../api/checkout', () => ({ quickBuy: vi.fn() }));

const mockQuickBuy = vi.mocked(quickBuy);

beforeEach(() => {
  mockQuickBuy.mockReset();
});

function trigger(w: ReturnType<typeof mount>) {
  return w.findAll('button').find((b) => b.text() === 'Купить в один клик')!;
}

describe('QuickBuy', () => {
  it('shows only the trigger button initially', () => {
    const w = mount(QuickBuy, { props: { productId: 5, lang: 'ru' } });
    expect(trigger(w).exists()).toBe(true);
    expect(w.find('form').exists()).toBe(false);
  });

  it('opens the form on click with phone + name fields', async () => {
    const w = mount(QuickBuy, { props: { productId: 5, lang: 'ru' } });
    await trigger(w).trigger('click');
    expect(w.find('form').exists()).toBe(true);
    expect(w.find('input[type="tel"]').exists()).toBe(true);
  });

  it('validates the phone client-side before calling the API', async () => {
    const w = mount(QuickBuy, { props: { productId: 5, lang: 'ru' } });
    await trigger(w).trigger('click');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(mockQuickBuy).not.toHaveBeenCalled();
    expect(w.text()).toContain('Введите телефон');
  });

  it('submits phone + name and shows the confirmation with the order number', async () => {
    mockQuickBuy.mockResolvedValue({
      data: { number: 'ORD-42' } as never,
      error: null,
    });
    const w = mount(QuickBuy, { props: { productId: 5, lang: 'ru' } });
    await trigger(w).trigger('click');
    await w.find('input[type="tel"]').setValue('069123456');
    await w.find('input[type="text"]').setValue('Ion');
    await w.find('form').trigger('submit');
    await flushPromises();

    expect(mockQuickBuy).toHaveBeenCalledWith(
      { product_id: 5, phone: '069123456', name: 'Ion' },
      'ru',
    );
    expect(w.find('form').exists()).toBe(false);
    expect(w.text()).toContain('Заказ №ORD-42 принят, мы перезвоним');
  });

  it('shows a localized out_of_stock message and keeps the form open', async () => {
    mockQuickBuy.mockResolvedValue({ data: null, error: 'out_of_stock' });
    const w = mount(QuickBuy, { props: { productId: 5, lang: 'ru' } });
    await trigger(w).trigger('click');
    await w.find('input[type="tel"]').setValue('069123456');
    await w.find('form').trigger('submit');
    await flushPromises();

    expect(w.find('form').exists()).toBe(true);
    expect(w.text()).toContain('Товара нет в наличии');
  });

  it('renders Romanian labels for lang=ro', async () => {
    const w = mount(QuickBuy, { props: { productId: 5, lang: 'ro' } });
    expect(w.text()).toContain('Cumpără într-un clic');
  });
});
