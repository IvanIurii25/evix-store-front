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
    expect(await req().text()).toBe(
      '{"email":"a@b.c","phone":"123","delivery_type":"courier","delivery_address_id":3}',
    );
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
