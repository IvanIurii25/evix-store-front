import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import OrdersTable from './OrdersTable.vue';
import { listOrders, type OrderOut, type OrderPage } from '../../api/admin';

vi.mock('../../api/admin', () => ({ listOrders: vi.fn() }));

const mockList = vi.mocked(listOrders);

const order = (over: Partial<OrderOut> = {}): OrderOut =>
  ({
    number: 'A-100',
    created_at: '2026-01-15T10:00:00Z',
    email: 'buyer@b.md',
    status: 'new',
    payment_status: 'pending',
    total: '1990',
    ...over,
  }) as OrderOut;

const pageOf = (
  data: OrderOut[],
  over: Partial<OrderPage> = {},
): OrderPage => ({
  data,
  total: data.length,
  page: 1,
  page_size: 20,
  ...over,
});

beforeEach(() => {
  mockList.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('OrdersTable', () => {
  it('shows a loading state before the first request resolves', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(OrdersTable);
    expect(w.text()).toContain('Загрузка');
  });

  it('requests the first page on mount and renders a row per order with mapped labels', async () => {
    mockList.mockResolvedValue(
      pageOf([
        order({ number: 'A-1', status: 'confirmed', payment_status: 'paid' }),
        order({ number: 'A-2', status: 'unknown', payment_status: 'weird' }),
      ]),
    );
    const w = mount(OrdersTable);
    await flushPromises();

    expect(mockList).toHaveBeenCalledWith({ page: 1, page_size: 20 });
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('A-1');
    expect(rows[0].text()).toContain('Подтверждён'); // status label
    expect(rows[0].text()).toContain('Оплачен'); // payment label
    expect(rows[0].text()).toMatch(/1.990 L/); // money format (NBSP separator)
    // Unknown status/payment fall back to the raw string.
    expect(rows[1].text()).toContain('unknown');
    expect(rows[1].text()).toContain('weird');
  });

  it('applies every status badge and payment badge branch', async () => {
    mockList.mockResolvedValue(
      pageOf([
        order({ number: 'N', status: 'new', payment_status: 'pending' }),
        order({ number: 'C', status: 'confirmed', payment_status: 'paid' }),
        order({ number: 'D', status: 'done', payment_status: 'refunded' }),
        order({ number: 'X', status: 'canceled', payment_status: '???' }),
        order({ number: 'Z', status: '???', payment_status: 'pending' }),
      ]),
    );
    const w = mount(OrdersTable);
    await flushPromises();
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(5);
    // canceled + default status badges use danger / fill respectively.
    expect(rows[3].html()).toContain('text-danger');
    expect(rows[4].html()).toContain('text-body');
  });

  it('shows the empty state when there are no orders', async () => {
    mockList.mockResolvedValue(pageOf([]));
    const w = mount(OrdersTable);
    await flushPromises();
    expect(w.text()).toContain('Заказов нет');
  });

  it('shows the error state when the request fails', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    const w = mount(OrdersTable);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('boom');
  });

  it('uses a fallback message for non-Error rejections', async () => {
    mockList.mockRejectedValue('x');
    const w = mount(OrdersTable);
    await flushPromises();
    expect(w.find('.text-danger').text()).toContain('Ошибка загрузки');
  });

  it('resets to page 1 and re-queries with the chosen status filter', async () => {
    mockList.mockResolvedValue(pageOf([order()], { page: 2, total: 100 }));
    const w = mount(OrdersTable);
    await flushPromises();
    mockList.mockClear();
    mockList.mockResolvedValue(pageOf([order()]));

    await w.find('select').setValue('done');
    await flushPromises();

    expect(mockList).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      status: 'done',
    });
  });

  it('debounces the search input and includes a trimmed query term', async () => {
    mockList.mockResolvedValue(pageOf([order()]));
    const w = mount(OrdersTable);
    await flushPromises();
    mockList.mockClear();

    await w.find('input[type="search"]').setValue('  A-100  ');
    // No call yet — debounce pending.
    expect(mockList).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await flushPromises();

    expect(mockList).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      q: 'A-100',
    });
  });

  it('paginates forward and backward and clamps at the edges', async () => {
    // total 45 / page_size 20 → 3 pages.
    mockList.mockResolvedValue(pageOf([order()], { total: 45, page: 1 }));
    const w = mount(OrdersTable);
    await flushPromises();

    expect(w.text()).toContain('стр 1 из 3');
    const [prevBtn, nextBtn] = w.findAll('button');
    // Prev disabled on page 1.
    expect(prevBtn.attributes('disabled')).toBeDefined();

    mockList.mockClear();
    mockList.mockResolvedValue(pageOf([order()], { total: 45, page: 2 }));
    await nextBtn.trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenCalledWith({ page: 2, page_size: 20 });

    mockList.mockClear();
    mockList.mockResolvedValue(pageOf([order()], { total: 45, page: 1 }));
    await w.findAll('button')[0].trigger('click'); // prev
    await flushPromises();
    expect(mockList).toHaveBeenCalledWith({ page: 1, page_size: 20 });
  });

  it('ignores prev/next clicks when they are not allowed', async () => {
    // Single page → both buttons disabled, guard clauses return early.
    mockList.mockResolvedValue(pageOf([order()], { total: 5, page: 1 }));
    const w = mount(OrdersTable);
    await flushPromises();
    mockList.mockClear();

    const [prevBtn, nextBtn] = w.findAll('button');
    expect(prevBtn.attributes('disabled')).toBeDefined();
    expect(nextBtn.attributes('disabled')).toBeDefined();
    // The guard functions short-circuit even if invoked programmatically.
    await nextBtn.trigger('click');
    await prevBtn.trigger('click');
    await flushPromises();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('navigates to the order detail page on row click', async () => {
    mockList.mockResolvedValue(pageOf([order({ number: 'A-77' })]));
    const original = window.location;
    const setter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...original,
        set href(v: string) {
          setter(v);
        },
      },
    });
    const w = mount(OrdersTable);
    await flushPromises();
    await w.find('tbody tr').trigger('click');
    expect(setter).toHaveBeenCalledWith('/admin/orders/A-77');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: original,
    });
  });
});
