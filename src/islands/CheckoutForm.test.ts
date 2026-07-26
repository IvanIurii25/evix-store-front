import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const quote = vi.fn();
const quoteResult = vi.fn();
const checkout = vi.fn();
vi.mock('../api/checkout', () => ({
  quote: (...a: unknown[]) => quote(...a),
  quoteResult: (...a: unknown[]) => quoteResult(...a),
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

    expect(quote).toHaveBeenCalledWith('pickup', null, 'ru', null);
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

    expect(quote).toHaveBeenLastCalledWith('courier', null, 'ru', null);
    expect(wrapper.text()).toContain('Укажите адрес доставки');

    const pickupRadio = wrapper.find('input[value="pickup"]');
    await pickupRadio.setValue();
    await flushPromises();
    expect(quote).toHaveBeenLastCalledWith('pickup', null, 'ru', null);
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
      null,
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
        delivery_address_id: null,
      },
      'ru',
    );
    // No PII in the URL: the email is passed via a short-lived cookie, not the
    // success URL (LP195/2024).
    expect(hrefStore).toBe('/ru/checkout/success?number=A-100');
    expect(document.cookie).toContain('order_email=buyer%40example.com');
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

    const asideButtons = wrapper.findAll('aside button');
    const btn = asideButtons[asideButtons.length - 1]; // submit is the last one
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
    const asideButtons = wrapper.findAll('aside button');
    await asideButtons[asideButtons.length - 1].trigger('click'); // submit
    await flushPromises();

    expect(checkout).toHaveBeenCalled();
    expect(hrefStore).toContain('number=B-2');
  });

  // --- Promo code ------------------------------------------------------- //
  const QUOTE_DISCOUNTED = {
    ...QUOTE,
    discount_total: '100',
    total: '898',
  };

  function promoInput(wrapper: ReturnType<typeof mount>) {
    return wrapper.find('input[placeholder="Введите код"]');
  }

  it('applies a promo code and shows the discount line', async () => {
    quote.mockResolvedValue(QUOTE);
    quoteResult.mockResolvedValue({ data: QUOTE_DISCOUNTED, error: null });
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await promoInput(wrapper).setValue('SALE100');
    await wrapper.find('button').trigger('click'); // Apply button (first button)
    await flushPromises();

    expect(quoteResult).toHaveBeenCalledWith(
      'pickup',
      null,
      'ru',
      null,
      'SALE100',
    );
    expect(wrapper.text()).toContain('Скидка');
    expect(wrapper.text()).toContain('898'); // discounted total
    expect(wrapper.text()).toContain('Код применён');
  });

  it('shows a localized error for an invalid promo code', async () => {
    quote.mockResolvedValue(QUOTE);
    quoteResult.mockResolvedValue({ data: null, error: 'promo_expired' });
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await promoInput(wrapper).setValue('OLD');
    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Срок действия промокода истёк');
    // The base quote is untouched — no discount line.
    expect(wrapper.text()).not.toContain('Скидка');
  });

  it('includes the applied promo_code in the checkout body', async () => {
    quote.mockResolvedValue(QUOTE);
    quoteResult.mockResolvedValue({ data: QUOTE_DISCOUNTED, error: null });
    checkout.mockResolvedValue({ number: 'P-1', email: 'buyer@example.com' });
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    await promoInput(wrapper).setValue('SALE100');
    await wrapper.find('button').trigger('click');
    await flushPromises();
    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(checkout).toHaveBeenCalledWith(
      expect.objectContaining({ promo_code: 'SALE100' }),
      'ru',
    );
  });

  const SAVED = [
    {
      id: 1,
      full_name: 'Анна',
      phone: '069000001',
      city: 'Бельцы',
      street: 'ул. Мира 5',
      zip: null,
      is_default: false,
    },
    {
      id: 2,
      full_name: 'Пётр',
      phone: '069000002',
      city: 'Кишинёв',
      street: 'ул. Дачия 10',
      zip: '2001',
      is_default: true,
    },
  ];

  it('renders the saved-address picker with the default preselected for a logged-in courier order', async () => {
    quote
      .mockResolvedValueOnce(QUOTE) // mount (pickup)
      .mockResolvedValueOnce(QUOTE_COURIER); // courier switch (saved addr picked)
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', isLoggedIn: true, savedAddresses: SAVED },
    });
    await flushPromises();

    await wrapper.find('input[value="courier"]').setValue();
    await flushPromises();

    // Picker rendered with both saved addresses.
    expect(wrapper.text()).toContain('Сохранённые адреса');
    expect(wrapper.text()).toContain('Анна');
    expect(wrapper.text()).toContain('Пётр');
    // Default address (id 2) preselected → quoted by id, no inline address.
    expect(quote).toHaveBeenLastCalledWith('courier', null, 'ru', 2);
    // Inline fields are hidden while a saved address is selected.
    const placeholders = wrapper
      .findAll('input')
      .map((i) => i.attributes('placeholder'));
    expect(placeholders).not.toContain('Имя получателя');
  });

  it('checks out with delivery_address_id when a saved address is used', async () => {
    quote.mockResolvedValueOnce(QUOTE).mockResolvedValueOnce(QUOTE_COURIER);
    checkout.mockResolvedValue({ number: 'S-9', email: 'buyer@example.com' });
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', isLoggedIn: true, savedAddresses: SAVED },
    });
    await flushPromises();

    await wrapper.find('input[value="courier"]').setValue();
    await flushPromises();
    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(checkout).toHaveBeenCalledWith(
      {
        email: 'buyer@example.com',
        phone: '069123456',
        delivery_type: 'courier',
        delivery_address: null,
        delivery_address_id: 2,
      },
      'ru',
    );
  });

  it('falls back to the inline address path when "another address" is chosen', async () => {
    quote
      .mockResolvedValueOnce(QUOTE) // mount
      .mockResolvedValueOnce(QUOTE_COURIER) // courier switch (saved picked)
      .mockResolvedValueOnce(null) // switched to "another" (empty inline)
      .mockResolvedValueOnce(QUOTE_COURIER); // inline complete
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', isLoggedIn: true, savedAddresses: SAVED },
    });
    await flushPromises();

    await wrapper.find('input[value="courier"]').setValue();
    await flushPromises();

    // Pick the "enter another address" radio (value null).
    const radios = wrapper.findAll('input[type="radio"]');
    const another = radios.find((r) => r.attributes('value') === undefined);
    await another!.setValue();
    await flushPromises();

    const addrInputs = wrapper.findAll('input').filter((i) => {
      const ph = i.attributes('placeholder');
      return (
        ph === 'Имя получателя' ||
        ph === 'Город' ||
        ph === 'Улица, дом, квартира'
      );
    });
    expect(addrInputs.length).toBe(3); // inline fields now visible
    await addrInputs[0].setValue('Гость');
    await addrInputs[1].setValue('Орхей');
    await addrInputs[2].setValue('ул. Лесная 2');
    await flushPromises();

    expect(quote).toHaveBeenLastCalledWith(
      'courier',
      { full_name: 'Гость', city: 'Орхей', street: 'ул. Лесная 2', zip: null },
      'ru',
      null,
    );
  });

  // --- Payment method selector (maib card) ------------------------------ //

  it('hides the card payment option when cardPaymentEnabled is false (default)', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    // No card radio, and no card-method label rendered.
    expect(wrapper.find('input[value="card"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Картой онлайн');
  });

  it('shows the COD + card radios when cardPaymentEnabled is true', async () => {
    quote.mockResolvedValue(QUOTE);
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', cardPaymentEnabled: true },
    });
    await flushPromises();

    expect(wrapper.find('input[value="cod"]').exists()).toBe(true);
    expect(wrapper.find('input[value="card"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Наличными при получении (COD)');
    expect(wrapper.text()).toContain('Картой онлайн');
  });

  it('redirects the browser to pay_url on a card checkout', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockResolvedValue({
      number: 'C-1',
      pay_url: 'https://maib.example/checkout/xyz',
    });
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', cardPaymentEnabled: true },
    });
    await flushPromises();

    await wrapper.find('input[value="card"]').setValue();
    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(checkout).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'card' }),
      'ru',
    );
    // Browser is redirected to the maib pay_url, not the success page.
    expect(hrefStore).toBe('https://maib.example/checkout/xyz');
  });

  it('shows an error and does not redirect when a card order has no pay_url', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockResolvedValue({ number: 'C-2', pay_url: null });
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', cardPaymentEnabled: true },
    });
    await flushPromises();

    await wrapper.find('input[value="card"]').setValue();
    await fillContacts(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Не удалось начать оплату картой');
    expect(hrefStore).toBe('');
  });

  it('keeps the COD body unchanged (no payment_method) when card is disabled', async () => {
    quote.mockResolvedValue(QUOTE);
    checkout.mockResolvedValue({ number: 'D-1', email: 'buyer@example.com' });
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
        delivery_address_id: null,
      },
      'ru',
    );
    // COD still redirects to the success page.
    expect(hrefStore).toBe('/ru/checkout/success?number=D-1');
  });

  it('shows no picker for a guest and keeps the inline courier flow (regression)', async () => {
    quote.mockResolvedValueOnce(QUOTE).mockResolvedValueOnce(null);
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', isLoggedIn: false, savedAddresses: SAVED },
    });
    await flushPromises();

    await wrapper.find('input[value="courier"]').setValue();
    await flushPromises();

    expect(wrapper.text()).not.toContain('Сохранённые адреса');
    const placeholders = wrapper
      .findAll('input')
      .map((i) => i.attributes('placeholder'));
    expect(placeholders).toContain('Имя получателя');
  });
});
