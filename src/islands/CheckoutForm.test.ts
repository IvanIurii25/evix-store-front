import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const quote = vi.fn();
const checkout = vi.fn();
vi.mock('../api/checkout', () => ({
  quote: (...a: unknown[]) => quote(...a),
  checkout: (...a: unknown[]) => checkout(...a),
}));

import CheckoutForm from './CheckoutForm.vue';

const QUOTE = {
  subtotal: '998',
  discount_total: '0',
  delivery_cost: '0',
  total: '998',
  delivery_type: 'pickup',
  item_count: 2,
};

const QUOTE_COURIER = {
  ...QUOTE,
  delivery_cost: '50',
  delivery_type: 'courier',
};

let hrefStore = '';
beforeEach(() => {
  vi.clearAllMocks();
  hrefStore = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return hrefStore;
      },
      set href(v: string) {
        hrefStore = v;
      },
    },
  });
});

async function fillContacts(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('input');
  await inputs[0].setValue('buyer@example.com'); // email
  await inputs[1].setValue('069123456'); // phone
  await wrapper.find('input[type="checkbox"]').setValue(true); // consent
}

describe('CheckoutForm', () => {
  it('quotes on mount and renders the order breakdown with a free delivery label', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    expect(quote).toHaveBeenCalledWith('pickup', null, 'ru');
    expect(wrapper.text()).toContain('998'); // total, formatted
    expect(wrapper.text()).toContain('бесплатно'); // free delivery (cost 0)
    expect(wrapper.text()).toContain('Товары (2)');
  });

  it('shows the "quote unavailable" fallback when the quote is null', async () => {
    quote.mockResolvedValue(null);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Расчёт недоступен.');
  });

  it('shows a paid delivery cost instead of the free label', async () => {
    quote.mockResolvedValue(QUOTE_COURIER);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();
    // The order-summary <dd> values: delivery row shows the formatted cost, not "free".
    const values = wrapper.findAll('dd').map((d) => d.text());
    expect(values.some((v) => v.includes('50'))).toBe(true);
    expect(values.some((v) => v.includes('бесплатно'))).toBe(false);
  });

  it('re-quotes when switching to courier and back, and shows an address error when incomplete', async () => {
    // pickup mount, then courier (incomplete addr → null quote → error), then back.
    quote
      .mockResolvedValueOnce(QUOTE) // mount (pickup)
      .mockResolvedValueOnce(null) // switch to courier, addr incomplete
      .mockResolvedValueOnce(QUOTE); // switch back to pickup
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    const courierRadio = wrapper.find('input[value="courier"]');
    await courierRadio.setValue();
    await flushPromises();

    expect(quote).toHaveBeenLastCalledWith('courier', null, 'ru');
    expect(wrapper.text()).toContain('Укажите адрес доставки');

    const pickupRadio = wrapper.find('input[value="pickup"]');
    await pickupRadio.setValue();
    await flushPromises();
    expect(quote).toHaveBeenLastCalledWith('pickup', null, 'ru');
  });

  it('builds the courier delivery address once all required fields are filled', async () => {
    quote
      .mockResolvedValueOnce(QUOTE) // mount
      .mockResolvedValueOnce(null) // courier switch (empty addr)
      .mockResolvedValueOnce(QUOTE_COURIER); // addr complete
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await wrapper.find('input[value="courier"]').setValue();
    await flushPromises();

    // Courier address inputs are the ones after email(0)/phone(1).
    const addrInputs = wrapper.findAll('input').filter((i) => {
      const ph = i.attributes('placeholder');
      return (
        ph === 'Имя получателя' ||
        ph === 'Город' ||
        ph === 'Улица, дом, квартира'
      );
    });
    await addrInputs[0].setValue('Иван'); // name
    await addrInputs[1].setValue('Кишинёв'); // city
    await addrInputs[2].setValue('ул. Пушкина 1'); // street
    await flushPromises();

    expect(quote).toHaveBeenLastCalledWith(
      'courier',
      {
        full_name: 'Иван',
        city: 'Кишинёв',
        street: 'ул. Пушкина 1',
        zip: null,
      },
      'ru',
    );
  });

  it('validates email before submitting', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('no-at-sign');
    await inputs[1].setValue('069123456');
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Введите корректный email');
    expect(checkout).not.toHaveBeenCalled();
  });

  it('validates phone length', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('buyer@example.com');
    await inputs[1].setValue('12'); // < 5
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Введите телефон');
    expect(checkout).not.toHaveBeenCalled();
  });

  it('requires consent', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('buyer@example.com');
    await inputs[1].setValue('069123456');
    // consent unchecked
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Подтвердите согласие с условиями');
    expect(checkout).not.toHaveBeenCalled();
  });

  it('reports errCalc when the quote is missing at submit time', async () => {
    quote.mockResolvedValue(null); // pickup path, no quote, no quoteError
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Расчёт недоступен');
    expect(checkout).not.toHaveBeenCalled();
  });

  it('submits a valid order and redirects to the success page', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockResolvedValue({ number: 'A-100', email: 'buyer@example.com' });
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(checkout).toHaveBeenCalledWith(
      {
        email: 'buyer@example.com',
        phone: '069123456',
        delivery_type: 'pickup',
        delivery_address: null,
      },
      'ru',
    );
    expect(hrefStore).toBe(
      '/ru/checkout/success?number=A-100&email=buyer%40example.com',
    );
  });

  it('surfaces the checkout Error message on failure', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockRejectedValue(new Error('Товара нет в наличии'));
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Товара нет в наличии');
    expect(hrefStore).toBe('');
  });

  it('falls back to the generic error for a non-Error throw', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockRejectedValue('boom');
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Ошибка');
  });

  it('enables the submit button only when the form can be submitted', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    const btn = wrapper.find('aside button');
    // Nothing filled yet → disabled.
    expect(btn.attributes('disabled')).toBeDefined();

    await fillContacts(wrapper);
    await flushPromises();
    expect(btn.attributes('disabled')).toBeUndefined();
  });

  it('submits successfully through the aside button click as well', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockResolvedValue({ number: 'B-2', email: 'buyer@example.com' });
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await fillContacts(wrapper);
    await flushPromises();
    await wrapper.find('aside button').trigger('click');
    await flushPromises();

    expect(checkout).toHaveBeenCalled();
    expect(hrefStore).toContain('number=B-2');
  });
});
