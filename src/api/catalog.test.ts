import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const BASE = 'http://localhost:58000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(status = 500): Response {
  return jsonResponse({ error: { code: 'E', message: 'boom' } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubOnce(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function url(): string {
  return (fetchMock.mock.calls[0][0] as Request).url;
}

async function load() {
  return import('./catalog');
}

describe('catalog api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getCategoryTree returns data and sends lang', async () => {
    stubOnce(jsonResponse([{ slug: 'auto' }]));
    const { getCategoryTree } = await load();
    await expect(getCategoryTree('ru')).resolves.toEqual([{ slug: 'auto' }]);
    expect(url()).toBe(`${BASE}/api/v1/catalog/categories?lang=ru`);
  });

  it('getCategoryTree returns [] when body is null', async () => {
    stubOnce(jsonResponse(null, 200));
    const { getCategoryTree } = await load();
    await expect(getCategoryTree('ru')).resolves.toEqual([]);
  });

  it('getCategory returns the category', async () => {
    stubOnce(jsonResponse({ slug: 'auto', name: 'Авто' }));
    const { getCategory } = await load();
    await expect(getCategory('auto', 'ru')).resolves.toEqual({
      slug: 'auto',
      name: 'Авто',
    });
    expect(url()).toBe(`${BASE}/api/v1/catalog/categories/auto?lang=ru`);
  });

  it('getCategory throws when the request errors', async () => {
    stubOnce(envelope(404));
    const { getCategory } = await load();
    await expect(getCategory('auto', 'ru')).rejects.toThrow(
      'getCategory(auto) failed',
    );
  });

  it('getCategory throws when data is null', async () => {
    stubOnce(jsonResponse(null, 200));
    const { getCategory } = await load();
    await expect(getCategory('auto', 'ru')).rejects.toThrow(
      'getCategory(auto) failed',
    );
  });

  it('listProducts forwards all opts into the query string', async () => {
    stubOnce(jsonResponse({ data: [{ id: 1 }], next_cursor: null }));
    const { listProducts } = await load();
    const res = await listProducts('auto', 'ru', {
      sort: 'price_asc' as never,
      cursor: 'c1',
      priceMin: 10,
      priceMax: 99,
      valueIds: [3, 4],
    });
    expect(res).toEqual({ data: [{ id: 1 }], next_cursor: null });
    const u = url();
    expect(u).toContain('/api/v1/catalog/categories/auto/products');
    expect(u).toContain('sort=price_asc');
    expect(u).toContain('cursor=c1');
    expect(u).toContain('price_min=10');
    expect(u).toContain('price_max=99');
    expect(u).toContain('value_ids=3');
    expect(u).toContain('value_ids=4');
  });

  it('listProducts works with default opts', async () => {
    stubOnce(jsonResponse({ data: [], next_cursor: null }));
    const { listProducts } = await load();
    await expect(listProducts('auto', 'ru')).resolves.toEqual({
      data: [],
      next_cursor: null,
    });
  });

  it('listProducts throws on error', async () => {
    stubOnce(envelope());
    const { listProducts } = await load();
    await expect(listProducts('auto', 'ru')).rejects.toThrow(
      'listProducts(auto) failed',
    );
  });

  it('listAllProducts forwards store-wide opts', async () => {
    stubOnce(jsonResponse({ data: [{ id: 9 }], next_cursor: 'n' }));
    const { listAllProducts } = await load();
    const res = await listAllProducts('ru', {
      sort: 'newest' as never,
      onSale: true,
      featured: false,
      cursor: 'x',
      priceMin: 1,
      priceMax: 2,
    });
    expect(res.data).toEqual([{ id: 9 }]);
    const u = url();
    expect(u).toContain('/api/v1/catalog/products');
    expect(u).toContain('on_sale=true');
    expect(u).toContain('featured=false');
  });

  it('listAllProducts throws on error', async () => {
    stubOnce(envelope());
    const { listAllProducts } = await load();
    await expect(listAllProducts('ru')).rejects.toThrow('listAllProducts failed');
  });

  it('getFacets returns facets on success', async () => {
    stubOnce(
      jsonResponse({ attributes: [{ id: 1 }], price_min: 5, price_max: 50 }),
    );
    const { getFacets } = await load();
    await expect(getFacets('auto', 'ru')).resolves.toEqual({
      attributes: [{ id: 1 }],
      price_min: 5,
      price_max: 50,
    });
    expect(url()).toBe(`${BASE}/api/v1/catalog/categories/auto/facets?lang=ru`);
  });

  it('getFacets degrades to an empty facets object on error', async () => {
    stubOnce(envelope());
    const { getFacets } = await load();
    await expect(getFacets('auto', 'ru')).resolves.toEqual({
      attributes: [],
      price_min: null,
      price_max: null,
    });
  });

  it('getProduct returns the product on success', async () => {
    stubOnce(jsonResponse({ slug: 'p1' }));
    const { getProduct } = await load();
    await expect(getProduct('p1', 'ru')).resolves.toEqual({ slug: 'p1' });
    expect(url()).toBe(`${BASE}/api/v1/catalog/products/p1?lang=ru`);
  });

  it('getProduct returns null on 404', async () => {
    stubOnce(envelope(404));
    const { getProduct } = await load();
    await expect(getProduct('p1', 'ru')).resolves.toBeNull();
  });

  it('getRelatedProducts returns cards and sends the limit', async () => {
    stubOnce(jsonResponse([{ id: 1 }, { id: 2 }]));
    const { getRelatedProducts } = await load();
    const res = await getRelatedProducts('p1', 'ru', 4);
    expect(res).toEqual([{ id: 1 }, { id: 2 }]);
    const u = url();
    expect(u).toContain('/api/v1/catalog/products/p1/related');
    expect(u).toContain('limit=4');
  });

  it('getRelatedProducts uses the default limit of 8', async () => {
    stubOnce(jsonResponse([]));
    const { getRelatedProducts } = await load();
    await getRelatedProducts('p1', 'ru');
    expect(url()).toContain('limit=8');
  });

  it('getRelatedProducts returns [] on failure', async () => {
    stubOnce(envelope());
    const { getRelatedProducts } = await load();
    await expect(getRelatedProducts('p1', 'ru')).resolves.toEqual([]);
  });

  it('getSitemap returns the feed on success', async () => {
    stubOnce(jsonResponse({ categories: [], products: [] }));
    const { getSitemap } = await load();
    await expect(getSitemap()).resolves.toEqual({
      categories: [],
      products: [],
    });
    expect(url()).toBe(`${BASE}/api/v1/catalog/sitemap`);
  });

  it('getSitemap throws on error', async () => {
    stubOnce(envelope());
    const { getSitemap } = await load();
    await expect(getSitemap()).rejects.toThrow('getSitemap failed');
  });
});
