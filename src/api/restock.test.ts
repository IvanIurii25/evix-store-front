import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const BASE = 'http://localhost:58000';

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
  return import('./restock');
}

describe('restock api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getRestockStatus reports authed + subscribed on success', async () => {
    stubOnce(jsonResponse({ subscribed: true }));
    const { getRestockStatus } = await load();
    await expect(getRestockStatus(7)).resolves.toEqual({
      authed: true,
      subscribed: true,
    });
    const r = req();
    expect(r.credentials).toBe('include');
    expect(r.url).toBe(`${BASE}/api/v1/restock/subscriptions/7`);
  });

  it('getRestockStatus coerces a falsy subscribed flag', async () => {
    stubOnce(jsonResponse({ subscribed: false }));
    const { getRestockStatus } = await load();
    await expect(getRestockStatus(7)).resolves.toEqual({
      authed: true,
      subscribed: false,
    });
  });

  it('getRestockStatus treats 401 as a guest', async () => {
    stubOnce(envelope(401));
    const { getRestockStatus } = await load();
    await expect(getRestockStatus(7)).resolves.toEqual({
      authed: false,
      subscribed: false,
    });
  });

  it('getRestockStatus treats other errors as authed + unsubscribed', async () => {
    stubOnce(envelope(500));
    const { getRestockStatus } = await load();
    await expect(getRestockStatus(7)).resolves.toEqual({
      authed: true,
      subscribed: false,
    });
  });

  it('subscribeRestock POSTs product_id + lang and returns ok', async () => {
    stubOnce(jsonResponse({ subscribed: true }, 201));
    const { subscribeRestock } = await load();
    await expect(subscribeRestock(7, 'ru')).resolves.toBe('ok');
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toBe(`${BASE}/api/v1/restock/subscriptions`);
    expect(await r.text()).toBe('{"product_id":7,"lang":"ru"}');
  });

  it('subscribeRestock returns guest on 401', async () => {
    stubOnce(envelope(401));
    const { subscribeRestock } = await load();
    await expect(subscribeRestock(7, 'ru')).resolves.toBe('guest');
  });

  it('subscribeRestock returns error on other failures', async () => {
    stubOnce(envelope(500));
    const { subscribeRestock } = await load();
    await expect(subscribeRestock(7, 'ru')).resolves.toBe('error');
  });

  it('unsubscribeRestock DELETEs the subscription', async () => {
    stubOnce(jsonResponse(null, 204));
    const { unsubscribeRestock } = await load();
    await expect(unsubscribeRestock(7)).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('DELETE');
    expect(r.url).toBe(`${BASE}/api/v1/restock/subscriptions/7`);
  });
});
