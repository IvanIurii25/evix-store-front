import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Dashboard from './Dashboard.vue';
import {
  dashboardSummary,
  revenueSeries,
  type DashboardSummary,
  type RevenueSeries,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({
  dashboardSummary: vi.fn(),
  revenueSeries: vi.fn(),
}));

const mockSummary = vi.mocked(dashboardSummary);
const mockSeries = vi.mocked(revenueSeries);

const summary = (over: Partial<DashboardSummary> = {}): DashboardSummary =>
  ({
    revenue: '123456',
    orders_count: 42,
    paid_orders_count: 30,
    avg_order_value: '2938',
    low_stock_count: 3,
    top_products: [
      { product_id: 1, name: 'Widget', qty_sold: 10, revenue: '5000' },
    ],
    low_stock: [
      { id: 1, code: 'SKU-1', qty: 2 },
      { id: 2, code: 'SKU-2', qty: 0 },
    ],
    status_distribution: [{ name: 'new', count: 5 }],
    ...over,
  }) as DashboardSummary;

const series = (over: Partial<RevenueSeries> = {}): RevenueSeries =>
  ({
    data: [
      { day: '2026-01-01', revenue: '1000' },
      { day: '2026-01-02', revenue: '2000' },
      { day: '2026-01-03', revenue: '500' },
    ],
    ...over,
  }) as RevenueSeries;

beforeEach(() => {
  mockSummary.mockReset();
  mockSeries.mockReset();
});

describe('Dashboard', () => {
  it('shows a loading state before the requests resolve', () => {
    mockSummary.mockReturnValue(new Promise(() => {}) as never);
    mockSeries.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(Dashboard);
    expect(w.text()).toContain('Загрузка');
  });

  it('renders KPI cards, the revenue bar chart, top products and low stock', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(series());
    const w = mount(Dashboard);
    await flushPromises();

    expect(mockSummary).toHaveBeenCalledOnce();
    expect(mockSeries).toHaveBeenCalledOnce();

    // KPIs (ru-RU formatting uses a NBSP group separator + " L" money suffix).
    expect(w.text()).toMatch(/123.456 L/);
    expect(w.text()).toContain('Оплачено: 30');
    expect(w.text()).toMatch(/2.938 L/);

    // One bar per series point.
    expect(w.findAll('rect')).toHaveLength(3);
    expect(w.text()).toContain('Максимум');

    // Lists.
    expect(w.text()).toContain('Widget');
    expect(w.text()).toContain('SKU-1');
    // Zero-qty low-stock item styled as danger.
    const dangerQty = w.findAll('.text-danger');
    expect(dangerQty.length).toBeGreaterThan(0);
    // Status distribution.
    expect(w.text()).toContain('new');
  });

  it('flags the low-stock KPI as danger when the count is positive', async () => {
    mockSummary.mockResolvedValue(summary({ low_stock_count: 7 }));
    mockSeries.mockResolvedValue(series());
    const w = mount(Dashboard);
    await flushPromises();
    // The low-stock KPI number renders with danger colour class.
    expect(w.html()).toContain('text-danger');
  });

  it('renders neutral low-stock KPI colour when the count is zero', async () => {
    mockSummary.mockResolvedValue(
      summary({ low_stock_count: 0, low_stock: [] }),
    );
    mockSeries.mockResolvedValue(series());
    const w = mount(Dashboard);
    await flushPromises();
    expect(w.text()).toContain('Всё в наличии');
  });

  it('shows empty placeholders when lists and series are empty', async () => {
    mockSummary.mockResolvedValue(
      summary({
        top_products: [],
        low_stock: [],
        status_distribution: [],
      }),
    );
    mockSeries.mockResolvedValue(series({ data: [] }));
    const w = mount(Dashboard);
    await flushPromises();

    expect(w.findAll('rect')).toHaveLength(0);
    expect(w.text()).toContain('Нет данных за период');
    expect(w.text()).toContain('Нет продаж');
    expect(w.text()).toContain('Всё в наличии');
    expect(w.text()).toContain('Нет заказов');
  });

  it('defaults undefined optional list/series fields to empty arrays', async () => {
    mockSummary.mockResolvedValue(
      summary({
        top_products: undefined,
        low_stock: undefined,
        status_distribution: undefined,
      }),
    );
    mockSeries.mockResolvedValue(series({ data: undefined }));
    const w = mount(Dashboard);
    await flushPromises();
    expect(w.findAll('rect')).toHaveLength(0);
    expect(w.text()).toContain('Нет продаж');
  });

  it('suppresses the chart when every revenue value is zero', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(
      series({
        data: [
          { day: '2026-01-01', revenue: '0', orders_count: 0 },
          { day: '2026-01-02', revenue: '0', orders_count: 0 },
        ],
      }),
    );
    const w = mount(Dashboard);
    await flushPromises();
    expect(w.findAll('rect')).toHaveLength(0);
    expect(w.text()).toContain('Нет данных за период');
  });

  it('renders the error state when a request rejects', async () => {
    mockSummary.mockRejectedValue(new Error('dash down'));
    mockSeries.mockResolvedValue(series());
    const w = mount(Dashboard);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('dash down');
  });

  it('uses a fallback message for non-Error rejections', async () => {
    mockSummary.mockRejectedValue('x');
    mockSeries.mockResolvedValue(series());
    const w = mount(Dashboard);
    await flushPromises();
    expect(w.find('.text-danger').text()).toContain(
      'Не удалось загрузить дашборд',
    );
  });
});
