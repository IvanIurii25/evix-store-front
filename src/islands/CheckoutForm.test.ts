import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The spies are created inside the mock factories (which vitest hoists) and
// read back through `vi.mocked`, so they carry the real modules' signatures: a
// fixture of the wrong shape fails typecheck. Wrapping them by hand typed the
// arguments as unknown[] and the payloads as never[], which made every fixture
// an error and left the mocks unchecked.
vi.mock('../api/checkout', () => ({
  quote: vi.fn(),
  quoteResult: vi.fn(),
  checkout: vi.fn(),
}));
vi.mock('../api/delivery', () => ({
  listDeliveryMethods: vi.fn(),
  searchSettlements: vi.fn(),
  listDivisions: vi.fn(),
}));

import CheckoutForm from './CheckoutForm.vue';
import * as checkoutApi from '../api/checkout';
import * as deliveryApi from '../api/delivery';

const quote = vi.mocked(checkoutApi.quote);
const quoteResult = vi.mocked(checkoutApi.quoteResult);
const checkout = vi.mocked(checkoutApi.checkout);
const listDeliveryMethods = vi.mocked(deliveryApi.listDeliveryMethods);
const searchSettlements = vi.mocked(deliveryApi.searchSettlements);
const listDivisions = vi.mocked(deliveryApi.listDivisions);

const QUOTE = {
  subtotal: '998',
  discount_total: '0',
  delivery_cost: '0',
  total: '998',
  delivery_type: 'pickup',
  delivery_service: 'own',
  item_count: 2,
};

const QUOTE_COURIER = {
  ...QUOTE,
  delivery_cost: '50',
  delivery_type: 'courier',
};

// A complete order, so a test can name only the fields it is about. Spelling
// out the whole contract once is what makes a missing field a typecheck error
// instead of an `undefined` the component silently renders.
const ORDER = {
  number: 'A-100',
  status: 'new',
  payment_status: 'pending',
  email: 'buyer@example.com',
  phone: '069123456',
  subtotal: '998',
  discount_total: '0',
  delivery_cost: '0',
  total: '998',
  delivery_type: 'pickup',
  delivery_service: 'own',
  delivery_address_id: null,
  payment_method: 'cod',
  created_at: '2026-08-01T10:00:00Z',
};

const order = (
  overrides: Partial<typeof ORDER> & { pay_url?: string | null },
) => ({ ...ORDER, ...overrides });

let hrefStore = '';
beforeEach(() => {
  vi.clearAllMocks();
  // The island asks the server which methods to offer on mount. Default: carrier
  // off, which is what every expectation outside the carrier block assumes.
  // Re-established per test, so a carrier fixture cannot leak into the next one.
  listDeliveryMethods.mockResolvedValue({
    methods: [],
    novapost_enabled: false,
  });
  searchSettlements.mockResolvedValue([]);
  listDivisions.mockResolvedValue([]);
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

    const courierRadio = wrapper.find('input[value="own:courier"]');
    await courierRadio.setValue();
    await flushPromises();

    expect(quote).toHaveBeenLastCalledWith('courier', null, 'ru', null);
    expect(wrapper.text()).toContain('Укажите адрес доставки');

    const pickupRadio = wrapper.find('input[value="own:pickup"]');
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

    await wrapper.find('input[value="own:courier"]').setValue();
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
    checkout.mockResolvedValue(order({ number: 'A-100' }));
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
    checkout.mockResolvedValue(order({ number: 'B-2' }));
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
    checkout.mockResolvedValue(order({ number: 'P-1' }));
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

    await wrapper.find('input[value="own:courier"]').setValue();
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
    checkout.mockResolvedValue(order({ number: 'S-9' }));
    const wrapper = mount(CheckoutForm, {
      props: { lang: 'ru', isLoggedIn: true, savedAddresses: SAVED },
    });
    await flushPromises();

    await wrapper.find('input[value="own:courier"]').setValue();
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

    await wrapper.find('input[value="own:courier"]').setValue();
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
    checkout.mockResolvedValue(
      order({ number: 'C-1', pay_url: 'https://maib.example/checkout/xyz' }),
    );
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
    checkout.mockResolvedValue(order({ number: 'C-2', pay_url: null }));
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
    checkout.mockResolvedValue(order({ number: 'D-1' }));
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

    await wrapper.find('input[value="own:courier"]').setValue();
    await flushPromises();

    expect(wrapper.text()).not.toContain('Сохранённые адреса');
    const placeholders = wrapper
      .findAll('input')
      .map((i) => i.attributes('placeholder'));
    expect(placeholders).toContain('Имя получателя');
  });
});

describe('CheckoutForm — Nova Post', () => {
  const CARRIER_METHODS = {
    novapost_enabled: true,
    methods: [
      {
        service: 'own',
        type: 'pickup',
        flat_cost: '0',
        free_from: null,
        address_fields: [],
      },
      {
        service: 'own',
        type: 'courier',
        flat_cost: '50',
        free_from: null,
        address_fields: [],
      },
      {
        service: 'novapost',
        type: 'branch',
        flat_cost: null,
        free_from: null,
        address_fields: [],
      },
      {
        service: 'novapost',
        type: 'postomat',
        flat_cost: null,
        free_from: null,
        address_fields: [],
      },
      {
        service: 'novapost',
        type: 'courier',
        flat_cost: null,
        free_from: null,
        address_fields: [
          {
            name: 'city',
            required: true,
            max_length: 100,
            label_ru: 'Город',
            label_ro: 'Oraș',
          },
          {
            name: 'street',
            required: true,
            max_length: 100,
            label_ru: 'Улица',
            label_ro: 'Stradă',
          },
          {
            name: 'building',
            required: true,
            max_length: 100,
            label_ru: 'Дом',
            label_ro: 'Casă',
          },
          {
            name: 'postCode',
            required: true,
            max_length: 10,
            label_ru: 'Индекс',
            label_ro: 'Cod',
          },
          {
            name: 'flat',
            required: false,
            max_length: 10,
            label_ru: 'Кв.',
            label_ro: 'Ap.',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    listDeliveryMethods.mockResolvedValue(CARRIER_METHODS);
    searchSettlements.mockResolvedValue([{ id: 's-1', name: 'Chișinău' }]);
    listDivisions.mockResolvedValue([
      {
        id: 'd-1',
        number: '1',
        address: 'str. Ștefan cel Mare 12',
        settlement_name: 'Chișinău',
      },
    ]);
  });

  it('offers only the carrier categories the server enabled', async () => {
    listDeliveryMethods.mockResolvedValue({
      novapost_enabled: true,
      methods: [
        {
          service: 'novapost',
          type: 'branch',
          flat_cost: null,
          free_from: null,
          address_fields: [],
        },
      ],
    });
    const w = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    expect(w.find('input[value="novapost:branch"]').exists()).toBe(true);
    expect(w.find('input[value="novapost:postomat"]').exists()).toBe(false);
  });

  it('hides every carrier option when the integration is off', async () => {
    listDeliveryMethods.mockResolvedValue({
      novapost_enabled: false,
      methods: [],
    });
    const w = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();

    expect(w.find('input[value="novapost:branch"]').exists()).toBe(false);
    expect(w.find('input[value="own:pickup"]').exists()).toBe(true);
  });

  it('does not quote a pickup point until one is chosen', async () => {
    const w = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();
    quote.mockClear();

    await w.find('input[value="novapost:branch"]').setValue();
    await flushPromises();

    // Nothing to price yet — the server would only reject it.
    expect(quote).not.toHaveBeenCalled();
  });

  it('quotes with the chosen city and pickup point', async () => {
    vi.useFakeTimers();
    const w = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();
    await w.find('input[value="novapost:branch"]').setValue();
    await flushPromises();

    const cityInput = w
      .findAll('input[type="text"]')
      .find((i) => i.attributes('placeholder')?.includes('город'))!;
    await cityInput.setValue('chi');
    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Chișinău')!
      .trigger('click');
    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();
    quote.mockClear();
    // The pickup-point radios render after the city is chosen; the last one is
    // the single stubbed branch.
    const pointRadios = w.findAll('input[type="radio"]');
    await pointRadios[pointRadios.length - 1].setValue();
    await flushPromises();
    vi.useRealTimers();

    const carrier = quote.mock.calls.at(-1)?.[5];
    expect(carrier).toMatchObject({
      delivery_service: 'novapost',
      np_settlement_id: 's-1',
      np_division_id: 'd-1',
    });
  });

  it('builds the carrier address from the server field contract', async () => {
    const w = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();
    await w.find('input[value="novapost:courier"]').setValue();
    await flushPromises();

    const placeholders = w
      .findAll('input[type="text"]')
      .map((i) => i.attributes('placeholder'))
      .filter(Boolean);

    // Required fields are marked, optional ones are not.
    expect(placeholders).toContain('Улица *');
    expect(placeholders).toContain('Кв.');
  });

  it('reports a carrier outage instead of blaming the address', async () => {
    vi.useFakeTimers();
    quote.mockResolvedValue(null);
    const w = mount(CheckoutForm, { props: { lang: 'ru' } });
    await flushPromises();
    await w.find('input[value="novapost:courier"]').setValue();
    await flushPromises();

    const inputs = w.findAll('input[type="text"]');
    const cityInput = inputs.find((i) =>
      i.attributes('placeholder')?.includes('город'),
    )!;
    await cityInput.setValue('chi');
    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Chișinău')!
      .trigger('click');
    await flushPromises();
    for (const [placeholder, value] of [
      ['Город *', 'Chișinău'],
      ['Улица *', 'str. Testului'],
      ['Дом *', '10'],
      ['Индекс *', 'MD2000'],
    ]) {
      const field = w
        .findAll('input[type="text"]')
        .find((i) => i.attributes('placeholder') === placeholder);
      if (field) await field.setValue(value);
    }
    await flushPromises();
    vi.useRealTimers();

    expect(w.text()).toContain('Служба доставки не отвечает');
  });
});
