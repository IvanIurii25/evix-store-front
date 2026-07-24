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
  return import('./cart');
}

describe('cart api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getCart returns the cart and sends lang + credentials', async () => {
    stubOnce(
      jsonResponse({ items: [{ id: 1 }], subtotal: '10', item_count: 1 }),
    );
    const { getCart } = await load();
    const res = await getCart('ru');
    expect(res).toEqual({ items: [{ id: 1 }], subtotal: '10', item_count: 1 });
    const r = req();
    expect(r.credentials).toBe('include');
    expect(r.url).toContain('/api/v1/cart');
    expect(r.url).toContain('lang=ru');
  });

  it('getCart degrades to the empty cart on failure', async () => {
    stubOnce(envelope(500));
    const { getCart } = await load();
    await expect(getCart()).resolves.toEqual({
      items: [],
      subtotal: '0',
      item_count: 0,
    });
  });

  it('addToCart POSTs product_id + qty and returns data', async () => {
    stubOnce(jsonResponse({ items: [{ product_id: 5, qty: 2 }] }));
    const { addToCart } = await load();
    const res = await addToCart(5, 2, 'ru');
    expect(res).toEqual({ items: [{ product_id: 5, qty: 2 }] });
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toContain('/api/v1/cart/items');
    expect(await r.text()).toBe('{"product_id":5,"qty":2}');
  });

  it('addToCart throws with the status code on error', async () => {
    stubOnce(envelope(409));
    const { addToCart } = await load();
    await expect(addToCart(5, 2)).rejects.toThrow('addToCart failed (409)');
  });

  it('updateItem PATCHes the item route', async () => {
    stubOnce(jsonResponse(null, 204));
    const { updateItem } = await load();
    await expect(updateItem(5, 3, 'ru')).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('PATCH');
    expect(r.url).toContain('/api/v1/cart/items/5');
    expect(await r.text()).toBe('{"qty":3}');
  });

  it('removeItem DELETEs the item route', async () => {
    stubOnce(jsonResponse(null, 204));
    const { removeItem } = await load();
    await expect(removeItem(5, 'ru')).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('DELETE');
    expect(r.url).toContain('/api/v1/cart/items/5');
  });

  it('mergeCart POSTs to the merge route', async () => {
    stubOnce(jsonResponse(null, 204));
    const { mergeCart } = await load();
    await expect(mergeCart()).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toBe(`${BASE}/api/v1/cart/merge`);
  });
});
