import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CustomerDetail from './CustomerDetail.vue';
import { getCustomer, type CustomerDetail as Detail } from '../../api/admin';

vi.mock('../../api/admin', () => ({ getCustomer: vi.fn() }));

const mockGet = vi.mocked(getCustomer);

const detail = (over: Partial<Detail> = {}): Detail =>
  ({
    id: 7,
    email: 'jane@example.com',
    phone: '+37360000000',
    is_active: true,
    created_at: '2026-01-10T00:00:00Z',
    loyalty_points: 42,
    orders_count: 3,
    total_spent: '12500',
    last_order_at: '2026-05-02T00:00:00Z',
    addresses: [],
    orders: [],
    ...over,
  }) as Detail;

beforeEach(() => mockGet.mockReset());

describe('CustomerDetail', () => {
  it('shows loading state before the request resolves', async () => {
    let resolve!: (v: Detail) => void;
    mockGet.mockReturnValue(new Promise<Detail>((r) => (resolve = r)));
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    expect(w.text()).toContain('Загрузка');
    resolve(detail());
    await flushPromises();
  });

  it('calls getCustomer with the customerId prop', async () => {
    mockGet.mockResolvedValue(detail());
    mount(CustomerDetail, { props: { customerId: 99 } });
    await flushPromises();
    expect(mockGet).toHaveBeenCalledWith(99);
  });

  it('renders the error message when loading fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('boom');
  });

  it('falls back to a generic error for non-Error throws', async () => {
    mockGet.mockRejectedValueOnce('nope');
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('Ошибка загрузки');
  });

  it('renders profile, stat cards and active badge', async () => {
    mockGet.mockResolvedValue(detail());
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('jane@example.com');
    expect(w.text()).toContain('+37360000000');
    expect(w.text()).toContain('Активен');
    // LTV money formatting
    expect(w.text()).toContain('12');
    // loyalty points
    expect(w.text()).toContain('42');
  });

  it('shows blocked badge and dash placeholders for inactive customer without phone/last order', async () => {
    mockGet.mockResolvedValue(
      detail({ is_active: false, phone: '', last_order_at: null }),
    );
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Заблокирован');
    expect(w.text()).toContain('—');
  });

  it('shows empty states when no addresses and no orders', async () => {
    mockGet.mockResolvedValue(detail({ addresses: [], orders: [] }));
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Адресов нет');
    expect(w.text()).toContain('Заказов нет');
    expect(w.find('table').exists()).toBe(false);
  });

  it('handles null addresses/orders arrays', async () => {
    mockGet.mockResolvedValue(
      detail({ addresses: null as never, orders: null as never }),
    );
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Адресов нет');
    expect(w.text()).toContain('Заказов нет');
  });

  it('renders addresses with default badge and zip', async () => {
    mockGet.mockResolvedValue(
      detail({
        addresses: [
          {
            id: 1,
            full_name: 'Jane Doe',
            is_default: true,
            city: 'Chisinau',
            street: 'Main 1',
            zip: 'MD-2000',
            phone: '+373600',
          },
          {
            id: 2,
            full_name: 'No Zip',
            is_default: false,
            city: 'Balti',
            street: 'Side 2',
            zip: '',
            phone: '+373601',
          },
        ] as never,
      }),
    );
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    const items = w.findAll('ul li');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain('Jane Doe');
    expect(items[0].text()).toContain('По умолчанию');
    expect(items[0].text()).toContain('MD-2000');
    // second address has no default badge
    expect(items[1].text()).not.toContain('По умолчанию');
  });

  it('renders order rows with mapped status/payment labels and money', async () => {
    mockGet.mockResolvedValue(
      detail({
        orders: [
          {
            number: 'A-1',
            created_at: '2026-04-01T00:00:00Z',
            status: 'confirmed',
            payment_status: 'paid',
            total: '2500',
          },
          {
            number: 'A-2',
            created_at: null,
            status: 'weird',
            payment_status: 'unknown',
            total: '100',
          },
        ] as never,
      }),
    );
    const w = mount(CustomerDetail, { props: { customerId: 7 } });
    await flushPromises();
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('A-1');
    expect(rows[0].text()).toContain('Подтверждён');
    expect(rows[0].text()).toContain('Оплачен');
    // unknown status/payment fall back to raw value
    expect(rows[1].text()).toContain('weird');
    expect(rows[1].text()).toContain('unknown');
    // null created_at -> dash
    expect(rows[1].text()).toContain('—');
  });
});
