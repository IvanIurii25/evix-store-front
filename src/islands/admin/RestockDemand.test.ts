import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import RestockDemand from './RestockDemand.vue';
import { getRestockDemand, type DemandItem } from '../../api/admin';

vi.mock('../../api/admin', () => ({ getRestockDemand: vi.fn() }));

const mockGet = vi.mocked(getRestockDemand);

const item = (over: Partial<DemandItem> = {}): DemandItem =>
  ({
    product_id: 1,
    name: 'Widget',
    category: 'Tools',
    in_stock: false,
    qty: 0,
    waiters: 5,
    waiters_7d: 2,
    price: '100',
    image_url: null,
    is_active: true,
    ...over,
  }) as DemandItem;

beforeEach(() => mockGet.mockReset());

describe('RestockDemand', () => {
  it('shows loading state before the request resolves', async () => {
    let resolve!: (v: DemandItem[]) => void;
    mockGet.mockReturnValue(new Promise<DemandItem[]>((r) => (resolve = r)));
    const w = mount(RestockDemand);
    expect(w.text()).toContain('Загрузка');
    resolve([]);
    await flushPromises();
  });

  it('requests demand for the ru locale on mount', async () => {
    mockGet.mockResolvedValue([]);
    mount(RestockDemand);
    await flushPromises();
    expect(mockGet).toHaveBeenCalledWith('ru');
  });

  it('renders the error message when loading fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('down'));
    const w = mount(RestockDemand);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('down');
  });

  it('falls back to a generic error for non-Error throws', async () => {
    mockGet.mockRejectedValueOnce({});
    const w = mount(RestockDemand);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('Ошибка загрузки');
  });

  it('shows the empty-filter row when nothing matches', async () => {
    mockGet.mockResolvedValue([]);
    const w = mount(RestockDemand);
    await flushPromises();
    expect(w.text()).toContain('Пока никто не ждёт');
    expect(w.findAll('tbody tr')).toHaveLength(1);
  });

  it('defaults to out-of-stock filter and renders KPI + rows', async () => {
    mockGet.mockResolvedValue([
      item({ product_id: 1, in_stock: false, waiters: 5, price: '100' }),
      item({ product_id: 2, in_stock: true, waiters: 8, price: '50' }),
    ]);
    const w = mount(RestockDemand);
    await flushPromises();
    // Only the OOS item is shown by default.
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Widget');
    // KPI products = 1
    expect(w.text()).toContain('Товаров ждут');
  });

  it('switches stock filter to all / in via buttons', async () => {
    mockGet.mockResolvedValue([
      item({ product_id: 1, in_stock: false, name: 'OOS' }),
      item({ product_id: 2, in_stock: true, qty: 4, name: 'INSTOCK' }),
    ]);
    const w = mount(RestockDemand);
    await flushPromises();
    const buttons = w.findAll('button');
    // buttons: [oos, all, in]
    await buttons[1].trigger('click'); // all
    expect(w.findAll('tbody tr')).toHaveLength(2);
    await buttons[2].trigger('click'); // in only
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('INSTOCK');
    // in-stock qty rendered
    expect(rows[0].text()).toContain('4 шт');
  });

  it('filters by category, min-waiters and search term', async () => {
    mockGet.mockResolvedValue([
      item({ product_id: 1, name: 'Alpha', category: 'Cat1', waiters: 2 }),
      item({ product_id: 2, name: 'Beta', category: 'Cat2', waiters: 9 }),
      item({ product_id: 3, name: 'Gamma', category: 'Cat1', waiters: 1 }),
    ]);
    const w = mount(RestockDemand);
    await flushPromises();
    const selects = w.findAll('select');
    // category select -> Cat1
    await selects[0].setValue('Cat1');
    expect(w.findAll('tbody tr')).toHaveLength(2);
    // min waiters >= 3 removes both Cat1 items
    await selects[1].setValue('3');
    expect(w.text()).toContain('Пока никто не ждёт');
    // reset min waiters and search
    await selects[1].setValue('1');
    await w.find('input[type="search"]').setValue('alph');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Alpha');
  });

  it('sorts by potential (default), waiters and waiters_7d via header clicks', async () => {
    mockGet.mockResolvedValue([
      item({ product_id: 1, name: 'Low', waiters: 2, waiters_7d: 1, price: '10' }),
      item({ product_id: 2, name: 'High', waiters: 3, waiters_7d: 9, price: '1000' }),
    ]);
    const w = mount(RestockDemand);
    await flushPromises();
    // default potential sort: High (3*1000) before Low
    let rows = w.findAll('tbody tr');
    expect(rows[0].text()).toContain('High');

    const headers = w.findAll('th.cursor-pointer');
    // headers: [waiters, waiters_7d, potential]
    await headers[0].trigger('click'); // waiters -> High(3) before Low(2)
    rows = w.findAll('tbody tr');
    expect(rows[0].text()).toContain('High');
    expect(headers[0].text()).toContain('↓');

    await headers[1].trigger('click'); // waiters_7d -> High(9) before Low(1)
    rows = w.findAll('tbody tr');
    expect(rows[0].text()).toContain('High');

    await headers[2].trigger('click'); // back to potential
    expect(headers[2].text()).toContain('↓');
  });

  it('renders thumbnail, inactive badge, category dash and 7d dash', async () => {
    mockGet.mockResolvedValue([
      item({
        product_id: 1,
        name: 'WithImg',
        category: null as never,
        image_url: 'https://cdn/x/pic.png',
        is_active: false,
        waiters_7d: 0,
      }),
    ]);
    const w = mount(RestockDemand);
    await flushPromises();
    const row = w.find('tbody tr');
    // thumb() rewrites extension to _200.webp
    expect(row.find('img').attributes('src')).toContain('pic_200.webp');
    expect(row.text()).toContain('неактивен');
    // null category -> dash, waiters_7d 0 -> dash
    expect(row.text()).toContain('—');
  });

  it('renders the placeholder box when image_url is null', async () => {
    mockGet.mockResolvedValue([item({ product_id: 1, image_url: null })]);
    const w = mount(RestockDemand);
    await flushPromises();
    expect(w.find('tbody tr img').exists()).toBe(false);
  });
});
