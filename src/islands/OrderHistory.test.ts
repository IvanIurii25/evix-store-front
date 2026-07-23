import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import OrderHistory from './OrderHistory.vue';
import { listOrders, type OrderOut } from '../api/account';

vi.mock('../api/account', () => ({ listOrders: vi.fn() }));

const mockList = vi.mocked(listOrders);

const order = (over: Partial<OrderOut> = {}): OrderOut =>
  ({
    number: 'A-100',
    status: 'new',
    created_at: '2026-01-15T10:00:00Z',
    total: '1990',
    payment_status: 'unpaid',
    ...over,
  }) as OrderOut;

beforeEach(() => mockList.mockReset());

describe('OrderHistory', () => {
  it('shows a loading state before the request resolves', async () => {
    let resolve!: (v: OrderOut[]) => void;
    mockList.mockReturnValue(new Promise<OrderOut[]>((r) => (resolve = r)) as never);
    const w = mount(OrderHistory, { props: { lang: 'ru' } });
    // loading text (accountStrings.loading) rendered, no list yet.
    expect(w.find('.text-subtle').exists()).toBe(true);
    expect(w.find('ul').exists()).toBe(false);
    resolve([]); // let the pending request settle so it doesn't leak
    await flushPromises();
  });

  it('shows the empty state when there are no orders', async () => {
    mockList.mockResolvedValue([]);
    const w = mount(OrderHistory, { props: { lang: 'ru' } });
    await flushPromises();
    expect(w.find('ul').exists()).toBe(false);
    expect(w.find('p').exists()).toBe(true);
  });

  it('renders a row per order with number, mapped status, formatted date and total', async () => {
    mockList.mockResolvedValue([
      order({ number: 'A-100', status: 'confirmed', total: '1990', payment_status: 'paid' }),
      order({ number: 'A-101', status: 'done', total: '500' }),
    ]);
    const w = mount(OrderHistory, { props: { lang: 'ru' } });
    await flushPromises();
    const rows = w.findAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('A-100');
    // 2026-01-15 formatted for ro-MD locale (dd.mm.yyyy)
    expect(rows[0].text()).toMatch(/15\.0?1\.2026/);
    expect(rows[0].text()).toContain('990');
  });

  it('falls back to the raw status string for unknown statuses', async () => {
    mockList.mockResolvedValue([order({ status: 'weird-status' })]);
    const w = mount(OrderHistory, { props: { lang: 'ru' } });
    await flushPromises();
    expect(w.find('li').text()).toContain('weird-status');
  });

  it('keeps an unparseable created_at value as-is', async () => {
    mockList.mockResolvedValue([order({ created_at: 'not-a-date' })]);
    const w = mount(OrderHistory, { props: { lang: 'ru' } });
    await flushPromises();
    expect(w.find('li').text()).toContain('not-a-date');
  });

  it('distinguishes paid vs awaiting-payment orders', async () => {
    mockList.mockResolvedValue([
      order({ number: 'PAID', payment_status: 'paid' }),
      order({ number: 'DUE', payment_status: 'unpaid' }),
    ]);
    const w = mount(OrderHistory, { props: { lang: 'ru' } });
    await flushPromises();
    const rows = w.findAll('li');
    // paid and awaiting labels differ; assert they are not identical strings.
    const paidLabel = rows[0].findAll('.text-xs')[0].text();
    const dueLabel = rows[1].findAll('.text-xs')[0].text();
    expect(paidLabel).not.toBe(dueLabel);
  });
});
