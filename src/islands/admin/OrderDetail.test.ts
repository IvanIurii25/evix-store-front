import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getOrder = vi.fn();
const transitionOrder = vi.fn();

const createWaybill = vi.fn();
const cancelWaybill = vi.fn();
vi.mock('../../api/admin', () => ({
  getOrder: (...a: unknown[]) => getOrder(...a),
  transitionOrder: (...a: unknown[]) => transitionOrder(...a),
  createWaybill: (...a: unknown[]) => createWaybill(...a),
  cancelWaybill: (...a: unknown[]) => cancelWaybill(...a),
}));

import OrderDetail from './OrderDetail.vue';

function order(over: Record<string, unknown> = {}) {
  return {
    number: 'ORD-1',
    status: 'new',
    payment_status: 'pending',
    created_at: '2026-07-01T10:00:00Z',
    email: 'buyer@x.com',
    phone: '060',
    delivery_type: 'courier',
    delivery_name: 'Ivan',
    delivery_city: 'Chisinau',
    delivery_street: 'Main 1',
    delivery_zip: 'MD-2000',
    payment_method: 'cash',
    subtotal: '100',
    discount_total: '10',
    delivery_cost: '20',
    total: '110',
    items: [{ name_snapshot: 'Item A', qty: 2, price_snapshot: '50' }],
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

async function mounted(o: Record<string, unknown>) {
  getOrder.mockResolvedValueOnce(o);
  const wrapper = mount(OrderDetail, { props: { number: 'ORD-1' } });
  await flushPromises();
  return wrapper;
}

describe('OrderDetail', () => {
  it('shows loading first, then the order header + courier fields + totals', async () => {
    let resolve!: (v: unknown) => void;
    getOrder.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const wrapper = mount(OrderDetail, { props: { number: 'ORD-1' } });
    expect(wrapper.text()).toContain('Загрузка…');

    resolve(order());
    await flushPromises();
    expect(getOrder).toHaveBeenCalledWith('ORD-1');
    expect(wrapper.text()).toContain('Заказ ORD-1');
    expect(wrapper.text()).toContain('Новый');
    expect(wrapper.text()).toContain('Ожидает');
    // courier delivery fields render
    expect(wrapper.text()).toContain('Получатель');
    expect(wrapper.text()).toContain('Chisinau');
    // line total 50 * 2 = 100, money formats
    expect(wrapper.text()).toContain('Item A');
  });

  it('renders an error state and its non-Error fallback', async () => {
    getOrder.mockRejectedValueOnce(new Error('not found'));
    const wrapper = mount(OrderDetail, { props: { number: 'ORD-1' } });
    await flushPromises();
    expect(wrapper.text()).toContain('not found');

    getOrder.mockRejectedValueOnce('weird');
    const wrapper2 = mount(OrderDetail, { props: { number: 'ORD-1' } });
    await flushPromises();
    expect(wrapper2.text()).toContain('Заказ не найден');
  });

  it('hides courier fields for a non-courier delivery type', async () => {
    const wrapper = await mounted(order({ delivery_type: 'pickup' }));
    expect(wrapper.text()).not.toContain('Получатель');
    expect(wrapper.text()).toContain('pickup');
  });

  it('omits individual courier rows that are empty', async () => {
    const wrapper = await mounted(
      order({
        delivery_name: '',
        delivery_city: '',
        delivery_street: '',
        delivery_zip: '',
      }),
    );
    expect(wrapper.text()).not.toContain('Получатель');
    expect(wrapper.text()).not.toContain('Индекс');
  });

  it('offers new->confirmed/canceled transitions and applies one, showing a success toast', async () => {
    const wrapper = await mounted(order());
    const btns = wrapper.findAll('button');
    expect(btns.find((b) => b.text() === 'Подтверждён')).toBeTruthy();
    expect(btns.find((b) => b.text() === 'Отменён')).toBeTruthy();

    transitionOrder.mockResolvedValueOnce(order({ status: 'confirmed' }));
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Подтверждён')!
      .trigger('click');
    await flushPromises();

    expect(transitionOrder).toHaveBeenCalledWith('ORD-1', {
      to_status: 'confirmed',
    });
    expect(wrapper.text()).toContain('Статус изменён: Подтверждён');
    // new payment transition button appears (pending -> paid) still present
    expect(
      wrapper.findAll('button').find((b) => b.text() === 'Оплачен'),
    ).toBeTruthy();
  });

  it('applies a payment transition (pending -> paid)', async () => {
    const wrapper = await mounted(order());
    transitionOrder.mockResolvedValueOnce(order({ payment_status: 'paid' }));
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Оплачен')!
      .trigger('click');
    await flushPromises();
    expect(transitionOrder).toHaveBeenCalledWith('ORD-1', {
      to_payment_status: 'paid',
    });
    expect(wrapper.text()).toContain('Оплата изменена: Оплачен');
  });

  it('shows a failure toast (Error and non-Error) on a rejected transition', async () => {
    const wrapper = await mounted(order());

    transitionOrder.mockRejectedValueOnce(new Error('illegal'));
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Подтверждён')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('illegal');

    transitionOrder.mockRejectedValueOnce('boom');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Подтверждён')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Не удалось выполнить переход');
  });

  it('auto-dismisses the toast after the timeout', async () => {
    const wrapper = await mounted(order());
    transitionOrder.mockResolvedValueOnce(order({ status: 'confirmed' }));
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Подтверждён')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Статус изменён');

    vi.advanceTimersByTime(3600);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Статус изменён');
  });

  it('renders terminal "no transitions" messages for done + refunded', async () => {
    const wrapper = await mounted(
      order({ status: 'done', payment_status: 'refunded' }),
    );
    expect(wrapper.text()).toContain('Выполнен');
    expect(wrapper.text()).toContain('Возврат');
    // both status and payment panels show the terminal note
    const notes =
      wrapper.text().match(/Финальный статус — переходов нет\./g) ?? [];
    expect(notes.length).toBe(2);
  });

  it('falls back to raw keys for unknown status/payment labels + default badges', async () => {
    const wrapper = await mounted(
      order({ status: 'weird', payment_status: 'odd' }),
    );
    expect(wrapper.text()).toContain('weird');
    expect(wrapper.text()).toContain('odd');
    // unknown -> STATUS_NEXT/PAYMENT_NEXT undefined -> terminal notes
    expect(wrapper.text()).toContain('Финальный статус');
  });

  it('ignores a second transition click while one is in flight (busy guard)', async () => {
    const wrapper = await mounted(order());
    let resolve!: (v: unknown) => void;
    transitionOrder.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const btn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Подтверждён')!;
    await btn.trigger('click');
    await btn.trigger('click'); // second click short-circuits on busy
    resolve(order({ status: 'confirmed' }));
    await flushPromises();
    expect(transitionOrder).toHaveBeenCalledTimes(1);
  });
});

describe('OrderDetail — Nova Post waybill', () => {
  const carrierOrder = (np: Record<string, unknown>) =>
    order({
      delivery_service: 'novapost',
      delivery_type: 'branch',
      delivery_name: 'Ion Client',
      novapost: {
        settlement_name: 'Chișinău',
        division_number: '1',
        division_address: 'str. Ștefan cel Mare 12',
        address_parts: null,
        awb_number: null,
        status_code: '',
        status_text: '',
        ...np,
      },
    });

  beforeEach(() => {
    createWaybill.mockReset();
    cancelWaybill.mockReset();
  });

  it('shows the destination and offers to create a waybill', async () => {
    getOrder.mockResolvedValue(carrierOrder({}));
    const w = mount(OrderDetail, { props: { number: 'ORD-1' } });
    await flushPromises();

    expect(w.text()).toContain('№ 1, str. Ștefan cel Mare 12, Chișinău');
    expect(w.text()).toContain('не создана');
    expect(
      w.findAll('button').some((b) => b.text().includes('Создать накладную')),
    ).toBe(true);
  });

  it('creates a waybill and shows its number', async () => {
    getOrder.mockResolvedValue(carrierOrder({}));
    createWaybill.mockResolvedValue(carrierOrder({ awb_number: 'STUB0001' }));
    const w = mount(OrderDetail, { props: { number: 'ORD-1' } });
    await flushPromises();

    await w
      .findAll('button')
      .find((b) => b.text().includes('Создать накладную'))!
      .trigger('click');
    await flushPromises();

    expect(createWaybill).toHaveBeenCalledWith('ORD-1');
    expect(w.text()).toContain('STUB0001');
  });

  it('offers cancellation once a waybill exists, and surfaces a refusal', async () => {
    getOrder.mockResolvedValue(carrierOrder({ awb_number: 'STUB0002' }));
    cancelWaybill.mockRejectedValue(new Error('Перевозчик недоступен'));
    vi.stubGlobal('confirm', () => true);
    const w = mount(OrderDetail, { props: { number: 'ORD-1' } });
    await flushPromises();

    const button = w
      .findAll('button')
      .find((b) => b.text().includes('Отменить накладную'))!;
    await button.trigger('click');
    await flushPromises();

    // The number stays on screen: our copy must not disappear while the parcel
    // may still be travelling.
    expect(w.text()).toContain('Перевозчик недоступен');
    expect(w.text()).toContain('STUB0002');
    vi.unstubAllGlobals();
  });

  it('shows no carrier block for an own-logistics order', async () => {
    getOrder.mockResolvedValue(order({ delivery_type: 'pickup' }));
    const w = mount(OrderDetail, { props: { number: 'ORD-1' } });
    await flushPromises();

    expect(w.text()).not.toContain('Накладная');
  });
});
