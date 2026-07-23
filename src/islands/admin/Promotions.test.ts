import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const listProducts = vi.fn();
const updateProduct = vi.fn();

vi.mock('../../api/admin', () => ({
  listProducts: (...a: unknown[]) => listProducts(...a),
  updateProduct: (...a: unknown[]) => updateProduct(...a),
}));

import Promotions from './Promotions.vue';

type Item = {
  id: number;
  code: string;
  name: string;
  price: string;
  old_price: string | null;
};

function item(over: Partial<Item> = {}): Item {
  return {
    id: 1,
    code: 'A1',
    name: 'Widget',
    price: '80',
    old_price: '100',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function mounted(sales: Item[]) {
  listProducts.mockResolvedValueOnce(sales);
  const wrapper = mount(Promotions);
  await flushPromises();
  return wrapper;
}

describe('Promotions', () => {
  it('shows loading first, then renders the active-sales table', async () => {
    let resolve!: (v: Item[]) => void;
    listProducts.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const wrapper = mount(Promotions);
    expect(wrapper.text()).toContain('Загрузка…');

    resolve([item()]);
    await flushPromises();
    expect(listProducts).toHaveBeenCalledWith({ on_sale: true });
    expect(wrapper.text()).toContain('Widget');
    expect(wrapper.text()).toContain('-20%'); // discountPercent 100->80
  });

  it('renders the empty state when there are no sales', async () => {
    const wrapper = await mounted([]);
    expect(wrapper.text()).toContain('Активных акций нет');
  });

  it('renders the load error and its non-Error fallback', async () => {
    listProducts.mockRejectedValueOnce(new Error('boom'));
    const wrapper = mount(Promotions);
    await flushPromises();
    expect(wrapper.text()).toContain('boom');

    listProducts.mockRejectedValueOnce('weird');
    const wrapper2 = mount(Promotions);
    await flushPromises();
    expect(wrapper2.text()).toContain('Не удалось загрузить акции');
  });

  it('shows a dash for a sale row with no old_price and no discount', async () => {
    const wrapper = await mounted([
      item({ id: 2, name: '', old_price: null, price: '50' }),
    ]);
    expect(wrapper.text()).toContain('— без названия —');
    // no old_price => struck line absent, discount cell shows dash
    expect(wrapper.findAll('.line-through')).toHaveLength(0);
  });

  // --- inline edit -----------------------------------------------------------
  it('edits a sale: validates zero prices, then price>=old, then saves', async () => {
    const wrapper = await mounted([item()]);
    await wrapper.findAll('button').find((b) => b.text() === 'Изменить')!.trigger('click');

    const numberInputs = wrapper.findAll('input[type="number"]');
    // clear price to trigger the >0 guard
    await numberInputs[1].setValue('0');
    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Цены должны быть больше нуля');
    expect(updateProduct).not.toHaveBeenCalled();

    // price >= old_price
    await numberInputs[0].setValue('60'); // old
    await numberInputs[1].setValue('90'); // price
    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Цена акции должна быть меньше старой цены');
    expect(updateProduct).not.toHaveBeenCalled();

    // valid save
    listProducts.mockResolvedValueOnce([item({ price: '70', old_price: '120' })]);
    updateProduct.mockResolvedValueOnce({});
    await numberInputs[0].setValue('120');
    await numberInputs[1].setValue('70');
    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click');
    await flushPromises();
    expect(updateProduct).toHaveBeenCalledWith(1, { price: 70, old_price: 120 });
  });

  it('surfaces a save error and its non-Error fallback', async () => {
    const wrapper = await mounted([item()]);
    await wrapper.findAll('button').find((b) => b.text() === 'Изменить')!.trigger('click');
    const numberInputs = wrapper.findAll('input[type="number"]');
    await numberInputs[0].setValue('120');
    await numberInputs[1].setValue('70');

    updateProduct.mockRejectedValueOnce(new Error('save-fail'));
    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('save-fail');

    updateProduct.mockRejectedValueOnce('x');
    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Не удалось сохранить');
  });

  it('cancels an inline edit', async () => {
    const wrapper = await mounted([item()]);
    await wrapper.findAll('button').find((b) => b.text() === 'Изменить')!.trigger('click');
    expect(wrapper.findAll('input[type="number"]').length).toBeGreaterThan(0);
    await wrapper.findAll('button').find((b) => b.text() === 'Отмена')!.trigger('click');
    expect(wrapper.findAll('input[type="number"]')).toHaveLength(0);
  });

  // --- remove sale -----------------------------------------------------------
  it('removes a sale after confirm, clearing old_price', async () => {
    window.confirm = vi.fn(() => true);
    const wrapper = await mounted([item()]);
    listProducts.mockResolvedValueOnce([]);
    updateProduct.mockResolvedValueOnce({});
    await wrapper.findAll('button').find((b) => b.text() === 'Снять акцию')!.trigger('click');
    await flushPromises();
    expect(updateProduct).toHaveBeenCalledWith(1, { old_price: null });
  });

  it('does nothing when the remove confirm is declined', async () => {
    window.confirm = vi.fn(() => false);
    const wrapper = await mounted([item({ name: '', code: 'C9' })]);
    await wrapper.findAll('button').find((b) => b.text() === 'Снять акцию')!.trigger('click');
    await flushPromises();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('handles a remove error path without crashing (Error + non-Error)', async () => {
    // rowError from removeSale only renders while the row is in edit mode, so we
    // assert the error branch runs (no unhandled rejection, list not reloaded).
    window.confirm = vi.fn(() => true);
    const wrapper = await mounted([item()]);

    updateProduct.mockRejectedValueOnce(new Error('rm-fail'));
    await wrapper.findAll('button').find((b) => b.text() === 'Снять акцию')!.trigger('click');
    await flushPromises();
    expect(updateProduct).toHaveBeenCalledTimes(1);
    // list still shows the row (refresh only runs on success)
    expect(wrapper.text()).toContain('Widget');

    updateProduct.mockRejectedValueOnce('x');
    await wrapper.findAll('button').find((b) => b.text() === 'Снять акцию')!.trigger('click');
    await flushPromises();
    expect(updateProduct).toHaveBeenCalledTimes(2);
  });

  // --- search + add ----------------------------------------------------------
  it('clears results and skips search for a blank term', async () => {
    const wrapper = await mounted([]);
    const box = wrapper.find('input[type="search"]');
    await box.setValue('   ');
    await box.trigger('input');
    vi.advanceTimersByTime(400);
    await flushPromises();
    // listProducts called once for the initial load only
    expect(listProducts).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain('Поиск…');
  });

  it('debounces a search then lists candidates', async () => {
    const wrapper = await mounted([]);
    listProducts.mockResolvedValueOnce([item({ id: 5, code: 'S5', name: 'Found' })]);
    const box = wrapper.find('input[type="search"]');
    await box.setValue('found');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(listProducts).toHaveBeenLastCalledWith({ search: 'found' });
    expect(wrapper.text()).toContain('Found');
  });

  it('shows the search error and its non-Error fallback', async () => {
    const wrapper = await mounted([]);
    const box = wrapper.find('input[type="search"]');

    listProducts.mockRejectedValueOnce(new Error('search-boom'));
    await box.setValue('x');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(wrapper.text()).toContain('search-boom');

    listProducts.mockRejectedValueOnce('y');
    await box.setValue('z');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(wrapper.text()).toContain('Ошибка поиска');
  });

  it('shows "nothing found" when a search yields no rows', async () => {
    const wrapper = await mounted([]);
    listProducts.mockResolvedValueOnce([]);
    const box = wrapper.find('input[type="search"]');
    await box.setValue('none');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(wrapper.text()).toContain('Ничего не найдено');
  });

  it('picks a candidate, validates the sale price, and puts it on sale', async () => {
    const wrapper = await mounted([]);
    listProducts.mockResolvedValueOnce([
      item({ id: 9, code: 'P9', name: '', price: '200' }),
    ]);
    const box = wrapper.find('input[type="search"]');
    await box.setValue('p9');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();

    await wrapper.findAll('button').find((b) => b.text() === 'В акцию')!.trigger('click');
    // candidate form appears, name blank -> placeholder
    expect(wrapper.text()).toContain('— без названия —');

    const priceInput = wrapper.find('input[type="number"]');
    // invalid: <= 0
    await priceInput.setValue('0');
    await wrapper.findAll('button').find((b) => b.text() === 'Запустить акцию')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Введите цену акции больше нуля');
    expect(updateProduct).not.toHaveBeenCalled();

    // invalid: >= current
    await priceInput.setValue('250');
    await wrapper.findAll('button').find((b) => b.text() === 'Запустить акцию')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Цена акции должна быть меньше текущей цены');

    // valid -> preview badge then save
    await priceInput.setValue('150');
    expect(wrapper.text()).toContain('-25%'); // previewDiscount 200->150
    listProducts.mockResolvedValueOnce([item({ id: 9, price: '150', old_price: '200' })]);
    updateProduct.mockResolvedValueOnce({});
    await wrapper.findAll('button').find((b) => b.text() === 'Запустить акцию')!.trigger('click');
    await flushPromises();
    expect(updateProduct).toHaveBeenCalledWith(9, {
      old_price: '200',
      price: 150,
    });
  });

  it('surfaces an add error and its non-Error fallback', async () => {
    const wrapper = await mounted([]);
    listProducts.mockResolvedValueOnce([item({ id: 9, price: '200' })]);
    const box = wrapper.find('input[type="search"]');
    await box.setValue('p9');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    await wrapper.findAll('button').find((b) => b.text() === 'В акцию')!.trigger('click');
    await wrapper.find('input[type="number"]').setValue('150');

    updateProduct.mockRejectedValueOnce(new Error('add-boom'));
    await wrapper.findAll('button').find((b) => b.text() === 'Запустить акцию')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('add-boom');

    updateProduct.mockRejectedValueOnce('z');
    await wrapper.findAll('button').find((b) => b.text() === 'Запустить акцию')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Не удалось добавить');
  });

  it('cancels a picked candidate', async () => {
    const wrapper = await mounted([]);
    listProducts.mockResolvedValueOnce([item({ id: 9 })]);
    const box = wrapper.find('input[type="search"]');
    await box.setValue('p9');
    await box.trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    await wrapper.findAll('button').find((b) => b.text() === 'В акцию')!.trigger('click');
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);
    await wrapper.findAll('button').find((b) => b.text() === 'Отмена')!.trigger('click');
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);
  });
});
