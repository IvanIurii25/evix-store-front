import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listAddresses = vi.fn();
const createAddress = vi.fn();
const deleteAddress = vi.fn();
const setDefaultAddress = vi.fn();

vi.mock('../api/account', () => ({
  listAddresses: (...a: unknown[]) => listAddresses(...a),
  createAddress: (...a: unknown[]) => createAddress(...a),
  deleteAddress: (...a: unknown[]) => deleteAddress(...a),
  setDefaultAddress: (...a: unknown[]) => setDefaultAddress(...a),
}));

import Addresses from './Addresses.vue';

const ADDR = {
  id: 1,
  full_name: 'Иван',
  phone: '060',
  city: 'Кишинёв',
  street: 'ул. Пушкина 1',
  zip: '2000',
  is_default: false,
};
const DEFAULT_ADDR = { ...ADDR, id: 2, full_name: 'Мария', is_default: true, zip: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Addresses', () => {
  it('shows loading, then the empty state with an Add button', async () => {
    let resolve!: (v: unknown[]) => void;
    listAddresses.mockReturnValue(new Promise((r) => (resolve = r)));
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });

    expect(wrapper.text()).toContain('Загрузка…');
    resolve([]);
    await flushPromises();

    expect(wrapper.text()).toContain('Адресов пока нет.');
    expect(wrapper.find('button').text()).toContain('Добавить адрес');
  });

  it('renders addresses, showing the default badge and zip formatting', async () => {
    listAddresses.mockResolvedValue([ADDR, DEFAULT_ADDR]);
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Иван');
    expect(wrapper.text()).toContain('Кишинёв, ул. Пушкина 1, 2000');
    // Default address gets the badge; non-default gets a "make default" button.
    expect(wrapper.text()).toContain('по умолчанию');
    const makeDefaultBtns = wrapper
      .findAll('button')
      .filter((b) => b.text() === 'Сделать основным');
    // Only the non-default (ADDR) shows the make-default action.
    expect(makeDefaultBtns.length).toBe(1);
  });

  it('opens the form and submits a new address, then reloads', async () => {
    listAddresses.mockResolvedValueOnce([]).mockResolvedValueOnce([ADDR]);
    createAddress.mockResolvedValue(ADDR);
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });
    await flushPromises();

    await wrapper.find('button').trigger('click'); // "+ Добавить адрес"
    expect(wrapper.find('form').exists()).toBe(true);

    const inputs = wrapper.findAll('form input');
    await inputs[0].setValue('Иван'); // full_name
    await inputs[1].setValue('060'); // phone
    await inputs[2].setValue('Кишинёв'); // city
    await inputs[3].setValue('ул. Пушкина 1'); // street
    // zip left blank → should become null
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Иван',
        phone: '060',
        city: 'Кишинёв',
        street: 'ул. Пушкина 1',
        zip: null,
      }),
    );
    expect(listAddresses).toHaveBeenCalledTimes(2); // initial + reload
    // Form closed after success.
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('keeps a provided zip when creating', async () => {
    listAddresses.mockResolvedValueOnce([]).mockResolvedValueOnce([ADDR]);
    createAddress.mockResolvedValue(ADDR);
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });
    await flushPromises();
    await wrapper.find('button').trigger('click');

    const inputs = wrapper.findAll('form input');
    await inputs[0].setValue('Иван');
    await inputs[2].setValue('Кишинёв');
    await inputs[3].setValue('ул. Пушкина 1');
    await inputs[4].setValue('2000'); // zip
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({ zip: '2000' }),
    );
  });

  it('does not submit when required fields are missing (validation guard)', async () => {
    listAddresses.mockResolvedValueOnce([]);
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });
    await flushPromises();
    await wrapper.find('button').trigger('click');

    // Fill only full_name — city/street missing.
    const inputs = wrapper.findAll('form input');
    await inputs[0].setValue('Иван');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createAddress).not.toHaveBeenCalled();
    expect(wrapper.find('form').exists()).toBe(true); // still open
  });

  it('deletes an address and reloads', async () => {
    listAddresses.mockResolvedValueOnce([ADDR]).mockResolvedValueOnce([]);
    deleteAddress.mockResolvedValue(undefined);
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });
    await flushPromises();

    const removeBtn = wrapper.findAll('button').find((b) => b.text() === 'Удалить')!;
    await removeBtn.trigger('click');
    await flushPromises();

    expect(deleteAddress).toHaveBeenCalledWith(1);
    expect(listAddresses).toHaveBeenCalledTimes(2);
  });

  it('sets an address as default and reloads', async () => {
    listAddresses
      .mockResolvedValueOnce([ADDR])
      .mockResolvedValueOnce([{ ...ADDR, is_default: true }]);
    setDefaultAddress.mockResolvedValue(undefined);
    const wrapper = mount(Addresses, { props: { lang: 'ru' } });
    await flushPromises();

    const btn = wrapper.findAll('button').find((b) => b.text() === 'Сделать основным')!;
    await btn.trigger('click');
    await flushPromises();

    expect(setDefaultAddress).toHaveBeenCalledWith(1);
    expect(listAddresses).toHaveBeenCalledTimes(2);
  });
});
