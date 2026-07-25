import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import SupportMetrics from './SupportMetrics.vue';
import { getSupportMetrics, type SupportMetricsOut } from '../../api/support';

vi.mock('../../api/support', () => ({ getSupportMetrics: vi.fn() }));

const mockGet = vi.mocked(getSupportMetrics);

const metrics = (over: Partial<SupportMetricsOut> = {}): SupportMetricsOut =>
  ({
    total: 12,
    new_in_period: 4,
    open: 3,
    pending: 1,
    closed: 8,
    unanswered: 2,
    avg_first_response_seconds: 150,
    series: [
      { day: '2026-01-14', count: 1 },
      { day: '2026-01-15', count: 3 },
    ],
    days: 30,
    ...over,
  }) as SupportMetricsOut;

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(metrics());
});

describe('SupportMetrics', () => {
  it('loads the 30-day window on mount and renders the stat cards', async () => {
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(mockGet).toHaveBeenCalledWith(30);
    expect(w.text()).toContain('12'); // total
    expect(w.text()).toContain('Без ответа');
    expect(w.text()).toContain('Открыто: 3');
    expect(w.text()).toContain('Закрыто: 8');
  });

  it('formats the average response time (150s → 3 мин)', async () => {
    mockGet.mockResolvedValue(metrics({ avg_first_response_seconds: 150 }));
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.text()).toContain('3 мин');
  });

  it('shows a dash when there is no response-time data', async () => {
    mockGet.mockResolvedValue(metrics({ avg_first_response_seconds: null }));
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.text()).toContain('—');
  });

  it('formats a sub-minute response time in seconds', async () => {
    mockGet.mockResolvedValue(metrics({ avg_first_response_seconds: 45 }));
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.text()).toContain('45 с');
  });

  it('formats an hours+minutes response time', async () => {
    mockGet.mockResolvedValue(metrics({ avg_first_response_seconds: 3900 }));
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.text()).toContain('1 ч');
  });

  it('renders a chart bar per series point', async () => {
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.findAll('svg rect')).toHaveLength(2);
  });

  it('reloads when the window changes', async () => {
    const w = mount(SupportMetrics);
    await flushPromises();
    await w.find('select').setValue('7');
    await flushPromises();
    expect(mockGet).toHaveBeenLastCalledWith(7);
  });

  it('surfaces a load error', async () => {
    mockGet.mockRejectedValue(new Error('нет доступа'));
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.text()).toContain('нет доступа');
  });

  it('shows the empty-chart state with no series', async () => {
    mockGet.mockResolvedValue(metrics({ series: [] }));
    const w = mount(SupportMetrics);
    await flushPromises();
    expect(w.text()).toContain('Нет данных за период');
  });
});
