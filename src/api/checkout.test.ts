import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(status: number): Response {
  return jsonResponse({ error: { code: 'E', message: 'x' } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubOnce(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function req(): Request {
  return fetchMock.mock.calls[0][0] as Request;
}

async function load() {
  return import('./checkout');
}

describe('checkout api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('quote POSTs delivery data and returns the quote', async () => {
    stubOnce(jsonResponse({ total: '120' }));
    const { quote } = await load();
    const res = await quote('courier', { city: 'Chisinau' } as never, 'ru');
    expect(res).toEqual({ total: '120' });
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.credentials).toBe('include');
    expect(r.url).toContain('/api/v1/checkout/quote');
    expect(r.url).toContain('lang=ru');
    expect(await r.text()).toBe(
      '{"delivery_type":"courier","delivery_address":{"city":"Chisinau"},"delivery_address_id":null}',
    );
  });

  it('quote defaults a missing address to null', async () => {
    stubOnce(jsonResponse({ total: '0' }));
    const { quote } = await load();
    await quote('pickup');
    expect(await req().text()).toBe(
      '{"delivery_type":"pickup","delivery_address":null,"delivery_address_id":null}',
    );
  });

  it('quote sends delivery_address_id when a saved address is picked', async () => {
    stubOnce(jsonResponse({ total: '50' }));
    const { quote } = await load();
    await quote('courier', null, 'ru', 7);
    expect(await req().text()).toBe(
      '{"delivery_type":"courier","delivery_address":null,"delivery_address_id":7}',
    );
  });

  it('quote returns null on error', async () => {
    stubOnce(envelope(400));
    const { quote } = await load();
    await expect(quote('courier')).resolves.toBeNull();
  });

  it('quote sends promo_code only when a code is passed', async () => {
    stubOnce(jsonResponse({ total: '90', discount_total: '10' }));
    const { quote } = await load();
    await quote('pickup', null, 'ru', null, '  SALE10 ');
    expect(await req().text()).toBe(
      '{"delivery_type":"pickup","delivery_address":null,"delivery_address_id":null,"promo_code":"SALE10"}',
    );
  });

  it('quoteResult returns data and no error on success', async () => {
    stubOnce(jsonResponse({ total: '90', discount_total: '10' }));
    const { quoteResult } = await load();
    const res = await quoteResult('pickup', null, 'ru', null, 'SALE10');
    expect(res).toEqual({
      data: { total: '90', discount_total: '10' },
      error: null,
    });
  });

  it('quoteResult surfaces the promo error code', async () => {
    stubOnce(
      jsonResponse({ error: { code: 'promo_expired', message: 'x' } }, 400),
    );
    const { quoteResult } = await load();
    const res = await quoteResult('pickup', null, 'ru', null, 'OLD');
    expect(res).toEqual({ data: null, error: 'promo_expired' });
  });

  it('checkout forwards promo_code in the body', async () => {
    stubOnce(jsonResponse({ number: 'ORD-P' }, 201));
    const { checkout } = await load();
    await checkout({
      email: 'a@b.c',
      phone: '1',
      delivery_type: 'pickup',
      promo_code: 'SALE10',
    });
    // payment_method defaults to "cod" (the generated CheckoutIn requires it).
    expect(JSON.parse(await req().text())).toEqual({
      payment_method: 'cod',
      email: 'a@b.c',
      phone: '1',
      delivery_type: 'pickup',
      promo_code: 'SALE10',
    });
  });

  it('checkout returns the created order', async () => {
    stubOnce(jsonResponse({ number: 'ORD-1' }, 201));
    const { checkout } = await load();
    const res = await checkout(
      { email: 'a@b.c', phone: '123', delivery_type: 'courier' },
      'ru',
    );
    expect(res).toEqual({ number: 'ORD-1' });
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toContain('/api/v1/checkout');
  });

  it('checkout forwards delivery_address_id in the body', async () => {
    stubOnce(jsonResponse({ number: 'ORD-2' }, 201));
    const { checkout } = await load();
    await checkout({
      email: 'a@b.c',
      phone: '123',
      delivery_type: 'courier',
      delivery_address_id: 3,
    });
    expect(JSON.parse(await req().text())).toEqual({
      payment_method: 'cod',
      email: 'a@b.c',
      phone: '123',
      delivery_type: 'courier',
      delivery_address_id: 3,
    });
  });

  it('checkout forwards payment_method:card and returns the pay_url order', async () => {
    stubOnce(jsonResponse({ number: 'ORD-C', pay_url: 'https://maib/x' }, 201));
    const { checkout } = await load();
    const res = await checkout({
      email: 'a@b.c',
      phone: '1',
      delivery_type: 'pickup',
      payment_method: 'card',
    });
    expect(res).toEqual({ number: 'ORD-C', pay_url: 'https://maib/x' });
    expect(JSON.parse(await req().text())).toEqual({
      payment_method: 'card',
      email: 'a@b.c',
      phone: '1',
      delivery_type: 'pickup',
    });
  });

  it.each([
    [400, 'Корзина пуста'],
    [422, 'Проверьте данные доставки'],
    [409, 'Товара нет в наличии'],
    [500, 'Не удалось оформить заказ'],
  ])('checkout maps status %i to its message', async (status, message) => {
    stubOnce(envelope(status));
    const { checkout } = await load();
    await expect(
      checkout({ email: 'a@b.c', phone: '1', delivery_type: 'courier' }),
    ).rejects.toThrow(message);
  });

  it('quickBuy POSTs product + phone and returns the order', async () => {
    stubOnce(jsonResponse({ number: 'ORD-Q1' }, 201));
    const { quickBuy } = await load();
    const res = await quickBuy({ product_id: 5, phone: '069123456' }, 'ru');
    expect(res).toEqual({ data: { number: 'ORD-Q1' }, error: null });
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toContain('/api/v1/checkout/quick');
    expect(r.url).toContain('lang=ru');
    expect(await r.text()).toBe('{"product_id":5,"phone":"069123456","qty":1}');
  });

  it('quickBuy sends name only when non-empty (trimmed)', async () => {
    stubOnce(jsonResponse({ number: 'ORD-Q2' }, 201));
    const { quickBuy } = await load();
    await quickBuy({ product_id: 7, phone: '111', name: '  Ion  ' });
    expect(await req().text()).toBe(
      '{"product_id":7,"phone":"111","qty":1,"name":"Ion"}',
    );
  });

  it('quickBuy omits an empty/whitespace name', async () => {
    stubOnce(jsonResponse({ number: 'ORD-Q3' }, 201));
    const { quickBuy } = await load();
    await quickBuy({ product_id: 7, phone: '111', name: '   ' });
    expect(await req().text()).toBe('{"product_id":7,"phone":"111","qty":1}');
  });

  it('quickBuy surfaces the out_of_stock error code', async () => {
    stubOnce(
      jsonResponse({ error: { code: 'out_of_stock', message: 'x' } }, 409),
    );
    const { quickBuy } = await load();
    const res = await quickBuy({ product_id: 5, phone: '069123456' });
    expect(res).toEqual({ data: null, error: 'out_of_stock' });
  });

  it('quickBuy maps a 422 (no envelope code) to "validation"', async () => {
    stubOnce(jsonResponse({ detail: [] }, 422));
    const { quickBuy } = await load();
    const res = await quickBuy({ product_id: 5, phone: 'x' });
    expect(res).toEqual({ data: null, error: 'validation' });
  });

  it('getOrder returns the order when found', async () => {
    stubOnce(jsonResponse({ number: 'ORD-1' }));
    const { getOrder } = await load();
    const res = await getOrder('ORD-1', 'a@b.c');
    expect(res).toEqual({ number: 'ORD-1' });
    // getOrder uses a plain fetch(url, init) (not the openapi client), so read
    // the call args directly rather than via req().
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(String(url)).toContain('/api/v1/orders/ORD-1/lookup');
    // Email is in the body, never the URL (no PII in URLs).
    expect(String(url)).not.toContain('email');
    expect(init.body).toBe('{"email":"a@b.c"}');
  });

  it('getOrder returns null on error', async () => {
    stubOnce(envelope(404));
    const { getOrder } = await load();
    await expect(getOrder('ORD-1', 'a@b.c')).resolves.toBeNull();
  });
});
