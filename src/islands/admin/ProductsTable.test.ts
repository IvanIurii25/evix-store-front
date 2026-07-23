import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import ProductsTable from './ProductsTable.vue';
import {
  listProducts,
  type ProductFilters,
  type ProductSearchItem,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({ listProducts: vi.fn() }));

const mockList = vi.mocked(listProducts);

const prod = (over: Partial<ProductSearchItem> = {}): ProductSearchItem =>
  ({
    id: 1,
    code: 'SKU-1',
    name: 'Product One',
    price: '1999',
    is_active: true,
    ...over,
  }) as ProductSearchItem;

beforeEach(() => {
  vi.useFakeTimers();
  mockList.mockReset();
  mockList.mockResolvedValue([]);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('ProductsTable', () => {
  it('shows loading state before the first request resolves', async () => {
    let resolve!: (v: ProductSearchItem[]) => void;
    mockList.mockReturnValueOnce(
      new Promise<ProductSearchItem[]>((r) => (resolve = r)),
    );
    const w = mount(ProductsTable);
    expect(w.text()).toContain('Загрузка');
    resolve([]);
    await flushPromises();
  });

  it('loads with empty filters on mount', async () => {
    mockList.mockResolvedValueOnce([prod()]);
    mount(ProductsTable);
    await flushPromises();
    expect(mockList).toHaveBeenCalledWith({});
  });

  it('renders the error message when loading fails', async () => {
    mockList.mockRejectedValueOnce(new Error('nope'));
    const w = mount(ProductsTable);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('nope');
  });

  it('falls back to a generic error for non-Error throws', async () => {
    mockList.mockRejectedValueOnce(42);
    const w = mount(ProductsTable);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('Ошибка загрузки');
  });

  it('shows the empty state when there are no products', async () => {
    mockList.mockResolvedValueOnce([]);
    const w = mount(ProductsTable);
    await flushPromises();
    expect(w.text()).toContain('Товаров нет');
    expect(w.find('table').exists()).toBe(false);
  });

  it('renders a row per product with code, name, money and status', async () => {
    mockList.mockResolvedValueOnce([
      prod({ id: 1, code: 'A', name: 'Named', is_active: true }),
      prod({ id: 2, code: 'B', name: '', is_active: false }),
    ]);
    const w = mount(ProductsTable);
    await flushPromises();
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('A');
    expect(rows[0].text()).toContain('Named');
    expect(rows[0].text()).toContain('Активен');
    // empty name -> placeholder, inactive -> Неактивен
    expect(rows[1].text()).toContain('без названия');
    expect(rows[1].text()).toContain('Неактивен');
  });

  it('navigates to the product page on row click', async () => {
    mockList.mockResolvedValueOnce([prod({ id: 55 })]);
    const w = mount(ProductsTable);
    await flushPromises();
    const href = { value: '' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return href.value;
        },
        set href(v: string) {
          href.value = v;
        },
      },
    });
    await w.find('tbody tr').trigger('click');
    expect(href.value).toBe('/admin/products/55');
  });

  it('toggles active/inactive/lowStock/onSale filters and re-queries', async () => {
    mockList.mockResolvedValue([prod()]);
    const w = mount(ProductsTable);
    await flushPromises();
    mockList.mockClear();

    const chips = w.findAll('.flex-wrap.gap-2 button');
    // chips: [Активные, Неактивные, Мало на складе, Со скидкой]
    await chips[0].trigger('click'); // active = true
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_active: true }),
    );

    await chips[0].trigger('click'); // toggle off -> null (no is_active)
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith({});

    await chips[1].trigger('click'); // inactive = false
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_active: false }),
    );

    await chips[2].trigger('click'); // low stock
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ low_stock: true }),
    );

    await chips[3].trigger('click'); // on sale
    await flushPromises();
    const lastCall = mockList.mock.calls.at(-1)![0] as ProductFilters;
    expect(lastCall.on_sale).toBe(true);
  });

  it('debounces the search box and passes the trimmed term', async () => {
    mockList.mockResolvedValue([prod()]);
    const w = mount(ProductsTable);
    await flushPromises();
    mockList.mockClear();

    await w.find('input[type="search"]').setValue('  hello  ');
    // debounced: not called yet
    expect(mockList).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'hello' }),
    );
  });
});
