import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Analytics from './Analytics.vue';
import {
  analyticsSummary,
  trafficSeries,
  type AnalyticsSummary,
  type TrafficSeries,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({
  analyticsSummary: vi.fn(),
  trafficSeries: vi.fn(),
}));

const mockSummary = vi.mocked(analyticsSummary);
const mockSeries = vi.mocked(trafficSeries);

const summary = (over: Partial<AnalyticsSummary> = {}): AnalyticsSummary =>
  ({
    pageviews: 12345,
    unique_visitors: 6789,
    bot_pageviews: 42,
    top_paths: [{ name: '/catalog', count: 500 }],
    top_referrers: [{ name: 'google.com', count: 300 }],
    device_breakdown: [
      { name: 'desktop', count: 80 },
      { name: 'mobile', count: 40 },
      { name: 'weird', count: 10 },
    ],
    ...over,
  }) as AnalyticsSummary;

const series = (over: Partial<TrafficSeries> = {}): TrafficSeries =>
  ({
    data: [
      { day: '2026-01-01', pageviews: 100, unique_visitors: 60 },
      { day: '2026-01-02', pageviews: 200, unique_visitors: 90 },
      { day: '2026-01-03', pageviews: 150, unique_visitors: 70 },
    ],
    ...over,
  }) as TrafficSeries;

beforeEach(() => {
  mockSummary.mockReset();
  mockSeries.mockReset();
});

describe('Analytics', () => {
  it('shows a loading state before the requests resolve', () => {
    mockSummary.mockReturnValue(new Promise(() => {}) as never);
    mockSeries.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(Analytics);
    expect(w.text()).toContain('Загрузка');
  });

  it('loads with the default (empty) range and renders KPI cards + chart', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(series());
    const w = mount(Analytics);
    await flushPromises();

    // Default range → no date params passed.
    expect(mockSummary).toHaveBeenCalledWith({});
    expect(mockSeries).toHaveBeenCalledWith({});

    // KPI values are ru-RU localised (grouping separators present).
    expect(w.text()).toMatch(/12.345/); // pageviews (NBSP separator)
    expect(w.text()).toMatch(/6.789/); // unique visitors
    expect(w.text()).toContain('42'); // bots

    // Both polylines drawn (3 points → multi-point path with spaces).
    const lines = w.findAll('polyline');
    expect(lines).toHaveLength(2);
    expect(lines[0].attributes('points')).toContain(' ');
    expect(w.text()).toContain('Максимум');

    // Device bars: known labels mapped, unknown falls through raw.
    expect(w.text()).toContain('Десктоп');
    expect(w.text()).toContain('Мобильные');
    expect(w.text()).toContain('weird');

    // Top paths + referrers lists.
    expect(w.text()).toContain('/catalog');
    expect(w.text()).toContain('google.com');
  });

  it('renders empty-data placeholders when lists and series are empty', async () => {
    mockSummary.mockResolvedValue(
      summary({ top_paths: [], top_referrers: [], device_breakdown: [] }),
    );
    mockSeries.mockResolvedValue(series({ data: [] }));
    const w = mount(Analytics);
    await flushPromises();

    expect(w.findAll('polyline')).toHaveLength(0);
    expect(w.text()).toContain('Нет данных за период');
    // Three "Нет данных" placeholders (paths, referrers, devices).
    expect(w.text().match(/Нет данных/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('handles undefined optional summary fields by defaulting to empty arrays', async () => {
    mockSummary.mockResolvedValue(
      summary({
        top_paths: undefined,
        top_referrers: undefined,
        device_breakdown: undefined,
      }),
    );
    mockSeries.mockResolvedValue(series({ data: undefined }));
    const w = mount(Analytics);
    await flushPromises();
    expect(w.findAll('polyline')).toHaveLength(0);
  });

  it('draws a flat line across the chart for a single-day series', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(
      series({ data: [{ day: '2026-01-01', pageviews: 100, unique_visitors: 60 }] }),
    );
    const w = mount(Analytics);
    await flushPromises();
    const lines = w.findAll('polyline');
    // Flat line = exactly two coordinate pairs (start + end at same y).
    expect(lines[0].attributes('points')!.trim().split(' ')).toHaveLength(2);
  });

  it('shows the empty chart placeholder when every value is zero', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(
      series({
        data: [
          { day: '2026-01-01', pageviews: 0, unique_visitors: 0 },
          { day: '2026-01-02', pageviews: 0, unique_visitors: 0 },
        ],
      }),
    );
    const w = mount(Analytics);
    await flushPromises();
    // chartMax === 0 → polylines suppressed, placeholder shown.
    expect(w.findAll('polyline')).toHaveLength(0);
    expect(w.text()).toContain('Нет данных за период');
  });

  it('renders the error state when a request rejects', async () => {
    mockSummary.mockRejectedValue(new Error('boom'));
    mockSeries.mockResolvedValue(series());
    const w = mount(Analytics);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('boom');
  });

  it('uses a fallback message for non-Error rejections', async () => {
    mockSummary.mockRejectedValue('nope');
    mockSeries.mockResolvedValue(series());
    const w = mount(Analytics);
    await flushPromises();
    expect(w.find('.text-danger').text()).toContain('Не удалось загрузить');
  });

  it('reloads with date params when a date input changes', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(series());
    const w = mount(Analytics);
    await flushPromises();
    mockSummary.mockClear();
    mockSeries.mockClear();

    const inputs = w.findAll('input[type="date"]');
    await inputs[0].setValue('2026-02-01');
    await inputs[0].trigger('change');
    await flushPromises();

    expect(mockSummary).toHaveBeenCalledWith({ date_from: '2026-02-01' });

    await inputs[1].setValue('2026-02-10');
    await inputs[1].trigger('change');
    await flushPromises();
    expect(mockSummary).toHaveBeenLastCalledWith({
      date_from: '2026-02-01',
      date_to: '2026-02-10',
    });
  });

  it('applies a quick preset which sets both dates and reloads', async () => {
    mockSummary.mockResolvedValue(summary());
    mockSeries.mockResolvedValue(series());
    const w = mount(Analytics);
    await flushPromises();
    mockSummary.mockClear();

    const buttons = w.findAll('button');
    await buttons[0].trigger('click'); // 7 дней
    await flushPromises();

    expect(mockSummary).toHaveBeenCalledTimes(1);
    const arg = mockSummary.mock.calls[0][0] as {
      date_from?: string;
      date_to?: string;
    };
    expect(arg.date_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arg.date_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await buttons[1].trigger('click'); // 30 дней
    await flushPromises();
    expect(mockSummary).toHaveBeenCalledTimes(2);
  });
});
