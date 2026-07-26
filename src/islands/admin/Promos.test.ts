import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listPromos = vi.fn();
const createPromo = vi.fn();
const updatePromo = vi.fn();
const deletePromo = vi.fn();

vi.mock('../../api/admin', () => ({
  listPromos: (...a: unknown[]) => listPromos(...a),
  createPromo: (...a: unknown[]) => createPromo(...a),
  updatePromo: (...a: unknown[]) => updatePromo(...a),
  deletePromo: (...a: unknown[]) => deletePromo(...a),
}));

import Promos from './Promos.vue';

beforeEach(() => {
  vi.clearAllMocks();
  listPromos.mockResolvedValue([]);
  createPromo.mockResolvedValue({});
});

async function openNewForm() {
  const wrapper = mount(Promos);
  await flushPromises();
  const newBtn = wrapper
    .findAll('button')
    .find((b) => b.text().includes('Новый'))!;
  await newBtn.trigger('click');
  return wrapper;
}

describe('Promos — save payload', () => {
  // Regression: <input type="number"> makes Vue cast the v-model to a *number*,
  // so the save() handler must not assume min_order_total / usage_limit are
  // strings. Calling String#trim on a number threw "trim is not a function" and
  // silently killed the submit (button stuck on "Сохранение…", promo never sent).
  it('builds the create payload when min order & usage limit are set (number-cast fields)', async () => {
    const wrapper = await openNewForm();

    await wrapper.find('input[placeholder="SALE10"]').setValue('QAMIN');
    // the only number input without a placeholder is discount_value
    const discountValue = wrapper
      .findAll('input[type="number"]')
      .find((i) => !i.attributes('placeholder'))!;
    await discountValue.setValue('10');
    await wrapper.find('input[placeholder="без ограничения"]').setValue('999999');
    await wrapper.find('input[placeholder="без лимита"]').setValue('3');
    const dates = wrapper.findAll('input[type="datetime-local"]');
    await dates[0].setValue('2020-01-01T00:00');
    await dates[1].setValue('2030-01-01T00:00');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createPromo).toHaveBeenCalledTimes(1);
    const body = createPromo.mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe('QAMIN');
    expect(body.min_order_total).toBe('999999');
    expect(body.usage_limit).toBe(3);
    expect(body.is_active).toBe(true);
  });

  it('sends null for optional min order & usage limit when left blank', async () => {
    const wrapper = await openNewForm();

    await wrapper.find('input[placeholder="SALE10"]').setValue('NOLIMITS');
    const discountValue = wrapper
      .findAll('input[type="number"]')
      .find((i) => !i.attributes('placeholder'))!;
    await discountValue.setValue('15');
    const dates = wrapper.findAll('input[type="datetime-local"]');
    await dates[0].setValue('2020-01-01T00:00');
    await dates[1].setValue('2030-01-01T00:00');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createPromo).toHaveBeenCalledTimes(1);
    const body = createPromo.mock.calls[0][0] as Record<string, unknown>;
    expect(body.min_order_total).toBeNull();
    expect(body.usage_limit).toBeNull();
  });
});
