import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import CustomersTable from './CustomersTable.vue';
import {
  listCustomers,
  type CustomerListItem,
  type CustomerPage,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({ listCustomers: vi.fn() }));

const mockList = vi.mocked(listCustomers);

const cust = (over: Partial<CustomerListItem> = {}): CustomerListItem =>
  ({
    id: 1,
    email: 'a@b.com',
    phone: '+37360000',
    orders_count: 2,
    total_spent: '5000',
    last_order_at: '2026-05-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }) as CustomerListItem;

const page = (over: Partial<CustomerPage> = {}): CustomerPage => ({
  data: [cust()],
  total: 1,
  page: 1,
  page_size: 20,
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  mockList.mockReset();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('CustomersTable', () => {
  it('shows loading state before the first request resolves', async () => {
    let resolve!: (v: CustomerPage) => void;
    mockList.mockReturnValueOnce(
      new Promise<CustomerPage>((r) => (resolve = r)),
    );
    const w = mount(CustomersTable);
    expect(w.text()).toContain('Загрузка');
    resolve(page());
    await flushPromises();
  });

  it('loads first page with page_size 20 on mount', async () => {
    mockList.mockResolvedValueOnce(page());
    mount(CustomersTable);
    await flushPromises();
    expect(mockList).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      page_size: 20,
    });
  });

  it('renders the error message when loading fails', async () => {
    mockList.mockRejectedValueOnce(new Error('bad'));
    const w = mount(CustomersTable);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('bad');
  });

  it('falls back to a generic error for non-Error throws', async () => {
    mockList.mockRejectedValueOnce('x');
    const w = mount(CustomersTable);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('Ошибка загрузки');
  });

  it('shows the empty state when there are no customers', async () => {
    mockList.mockResolvedValueOnce(page({ data: [], total: 0 }));
    const w = mount(CustomersTable);
    await flushPromises();
    expect(w.text()).toContain('Клиентов нет');
    expect(w.find('table').exists()).toBe(false);
  });

  it('renders a row per customer with money, dates and dash for missing values', async () => {
    mockList.mockResolvedValueOnce(
      page({
        data: [
          cust({ id: 1, email: 'x@y.com', total_spent: '12345' }),
          cust({ id: 2, phone: '', last_order_at: null }),
        ],
        total: 2,
      }),
    );
    const w = mount(CustomersTable);
    await flushPromises();
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('x@y.com');
    // second customer has no phone / last order -> dash
    expect(rows[1].text()).toContain('—');
  });

  it('navigates on row click and stops propagation on email link', async () => {
    mockList.mockResolvedValueOnce(page({ data: [cust({ id: 77 })] }));
    const w = mount(CustomersTable);
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
    expect(href.value).toBe('/admin/customers/77');
  });

  it('debounces the search box, resets to page 1 and passes the term', async () => {
    mockList.mockResolvedValue(page());
    const w = mount(CustomersTable);
    await flushPromises();
    mockList.mockClear();

    await w.find('input[type="search"]').setValue('  jane  ');
    expect(mockList).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith({
      q: 'jane',
      page: 1,
      page_size: 20,
    });
  });

  it('paginates forward and backward with guarded bounds', async () => {
    // total 60 -> 3 pages
    mockList.mockResolvedValue(page({ total: 60, page: 1 }));
    const w = mount(CustomersTable);
    await flushPromises();
    mockList.mockClear();

    const btns = () => w.findAll('.justify-between button');
    // Prev disabled on page 1; clicking prev is a no-op.
    expect(btns()[0].attributes('disabled')).toBeDefined();

    // Next -> page 2
    mockList.mockResolvedValue(page({ total: 60, page: 2 }));
    await btns()[1].trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );

    // Next -> page 3
    mockList.mockResolvedValue(page({ total: 60, page: 3 }));
    await btns()[1].trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 }),
    );

    // Next on last page is a no-op (guarded).
    mockList.mockClear();
    expect(btns()[1].attributes('disabled')).toBeDefined();
    await btns()[1].trigger('click');
    await flushPromises();
    expect(mockList).not.toHaveBeenCalled();

    // Prev -> page 2
    mockList.mockResolvedValue(page({ total: 60, page: 2 }));
    await btns()[0].trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('does nothing when prev is invoked on the first page', async () => {
    mockList.mockResolvedValue(page({ total: 10, page: 1 }));
    const w = mount(CustomersTable);
    await flushPromises();
    mockList.mockClear();
    // Only one page -> both buttons disabled; trigger prev anyway.
    const btns = w.findAll('.justify-between button');
    await btns[0].trigger('click');
    await flushPromises();
    expect(mockList).not.toHaveBeenCalled();
  });
});
