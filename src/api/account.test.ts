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
  return import('./account');
}

describe('account api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('listAddresses returns the addresses', async () => {
    stubOnce(jsonResponse([{ id: 1 }, { id: 2 }]));
    const { listAddresses } = await load();
    await expect(listAddresses()).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    const r = req();
    expect(r.credentials).toBe('include');
    expect(r.url).toBe(`${BASE}/api/v1/users/me/addresses`);
  });

  it('listAddresses returns [] on failure', async () => {
    stubOnce(envelope(500));
    const { listAddresses } = await load();
    await expect(listAddresses()).resolves.toEqual([]);
  });

  it('createAddress POSTs the body and returns the address', async () => {
    stubOnce(jsonResponse({ id: 3 }, 201));
    const { createAddress } = await load();
    const res = await createAddress({ city: 'Chisinau' } as never);
    expect(res).toEqual({ id: 3 });
    const r = req();
    expect(r.method).toBe('POST');
    expect(await r.text()).toBe('{"city":"Chisinau"}');
  });

  it('createAddress returns null on failure', async () => {
    stubOnce(envelope(422));
    const { createAddress } = await load();
    await expect(createAddress({} as never)).resolves.toBeNull();
  });

  it('deleteAddress DELETEs by id', async () => {
    stubOnce(jsonResponse(null, 204));
    const { deleteAddress } = await load();
    await expect(deleteAddress(3)).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('DELETE');
    expect(r.url).toBe(`${BASE}/api/v1/users/me/addresses/3`);
  });

  it('setDefaultAddress PATCHes is_default', async () => {
    stubOnce(jsonResponse(null, 204));
    const { setDefaultAddress } = await load();
    await expect(setDefaultAddress(3)).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('PATCH');
    expect(r.url).toBe(`${BASE}/api/v1/users/me/addresses/3`);
    expect(await r.text()).toBe('{"is_default":true}');
  });

  it('listOrders returns the orders', async () => {
    stubOnce(jsonResponse([{ number: 'ORD-1' }]));
    const { listOrders } = await load();
    await expect(listOrders()).resolves.toEqual([{ number: 'ORD-1' }]);
    expect(req().url).toBe(`${BASE}/api/v1/orders`);
  });

  it('listOrders returns [] on failure', async () => {
    stubOnce(envelope(500));
    const { listOrders } = await load();
    await expect(listOrders()).resolves.toEqual([]);
  });
});
