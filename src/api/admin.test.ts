import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// admin.ts is a set of typed wrappers over the shared openapi-fetch client. We
// stub global fetch (which openapi-fetch calls under the hood) so the real
// request-building runs, then assert URL / method / body plus the success and
// error-envelope branches. `credentials: 'include'` is asserted on the Request.

const BASE = 'http://localhost:58000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(message: string, status = 400): Response {
  return jsonResponse({ error: { code: 'ERR', message } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

async function load() {
  return import('./admin');
}

function stubOnce(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function lastRequest(): Request {
  return fetchMock.mock.calls[0][0] as Request;
}

describe('admin api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------ products
  describe('products', () => {
    it('listProducts builds the query string and unwraps data.data', async () => {
      stubOnce(jsonResponse({ data: [{ id: 1 }, { id: 2 }] }));
      const { listProducts } = await load();

      const res = await listProducts({
        search: 'lamp',
        is_active: true,
        low_stock: false,
        on_sale: true,
        limit: 20,
      });

      expect(res).toEqual([{ id: 1 }, { id: 2 }]);
      const req = lastRequest();
      expect(req.method).toBe('GET');
      expect(req.credentials).toBe('include');
      expect(req.url).toContain(`${BASE}/api/v1/admin/products?`);
      expect(req.url).toContain('search=lamp');
      expect(req.url).toContain('limit=20');
    });

    it('listProducts defaults to [] when the envelope omits data', async () => {
      stubOnce(jsonResponse({}));
      const { listProducts } = await load();
      await expect(listProducts()).resolves.toEqual([]);
    });

    it('listProducts throws the backend message on error', async () => {
      stubOnce(envelope('нет доступа'));
      const { listProducts } = await load();
      await expect(listProducts()).rejects.toThrow('нет доступа');
    });

    it('listProducts falls back to the default message when envelope is bare', async () => {
      stubOnce(jsonResponse({}, 500));
      const { listProducts } = await load();
      await expect(listProducts()).rejects.toThrow(
        'Не удалось загрузить товары',
      );
    });

    it('getProduct hits the path route and returns the product', async () => {
      stubOnce(jsonResponse({ id: 7, sku: 'X' }));
      const { getProduct } = await load();
      const res = await getProduct(7);
      expect(res).toEqual({ id: 7, sku: 'X' });
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/products/7`);
    });

    it('getProduct throws on 404', async () => {
      stubOnce(envelope('missing', 404));
      const { getProduct } = await load();
      await expect(getProduct(7)).rejects.toThrow('missing');
    });

    it('createProduct POSTs the JSON body', async () => {
      stubOnce(jsonResponse({ id: 11 }, 201));
      const { createProduct } = await load();
      const res = await createProduct({ sku: 'NEW' } as never);
      expect(res).toEqual({ id: 11 });
      const req = lastRequest();
      expect(req.method).toBe('POST');
      expect(await req.text()).toBe('{"sku":"NEW"}');
    });

    it('createProduct throws its default message', async () => {
      stubOnce(jsonResponse({}, 422));
      const { createProduct } = await load();
      await expect(createProduct({} as never)).rejects.toThrow(
        'Не удалось создать товар',
      );
    });

    it('updateProduct PATCHes the path route', async () => {
      stubOnce(jsonResponse({ id: 3, name: 'upd' }));
      const { updateProduct } = await load();
      const res = await updateProduct(3, { name: 'upd' } as never);
      expect(res).toEqual({ id: 3, name: 'upd' });
      const req = lastRequest();
      expect(req.method).toBe('PATCH');
      expect(req.url).toBe(`${BASE}/api/v1/admin/products/3`);
    });

    it('updateProduct throws on error', async () => {
      stubOnce(envelope('save failed'));
      const { updateProduct } = await load();
      await expect(updateProduct(3, {} as never)).rejects.toThrow(
        'save failed',
      );
    });

    it('deleteProduct DELETEs and resolves void on success', async () => {
      stubOnce(jsonResponse(null, 204));
      const { deleteProduct } = await load();
      await expect(deleteProduct(9)).resolves.toBeUndefined();
      const req = lastRequest();
      expect(req.method).toBe('DELETE');
      expect(req.url).toBe(`${BASE}/api/v1/admin/products/9`);
    });

    it('deleteProduct throws on error', async () => {
      stubOnce(envelope('cannot delete'));
      const { deleteProduct } = await load();
      await expect(deleteProduct(9)).rejects.toThrow('cannot delete');
    });

    it('setProductTranslation PUTs the translation body', async () => {
      stubOnce(jsonResponse(null, 204));
      const { setProductTranslation } = await load();
      await expect(
        setProductTranslation(4, { lang: 'ru', name: 'Имя' } as never),
      ).resolves.toBeUndefined();
      const req = lastRequest();
      expect(req.method).toBe('PUT');
      expect(req.url).toBe(`${BASE}/api/v1/admin/products/4/translations`);
    });

    it('setProductTranslation throws on error', async () => {
      stubOnce(envelope('bad translation'));
      const { setProductTranslation } = await load();
      await expect(setProductTranslation(4, {} as never)).rejects.toThrow(
        'bad translation',
      );
    });

    it('uploadProductMedia posts multipart form data', async () => {
      stubOnce(jsonResponse({ id: 50, url: 'x' }));
      const { uploadProductMedia } = await load();
      const file = new File(['bytes'], 'p.jpg', { type: 'image/jpeg' });
      const res = await uploadProductMedia(2, file);
      expect(res).toEqual({ id: 50, url: 'x' });
      const req = lastRequest();
      expect(req.method).toBe('POST');
      expect(req.url).toBe(`${BASE}/api/v1/admin/products/2/media`);
      expect(req.headers.get('content-type')).toContain('multipart/form-data');
    });

    it('uploadProductMedia throws on error', async () => {
      stubOnce(envelope('upload failed'));
      const { uploadProductMedia } = await load();
      const file = new File(['x'], 'p.jpg');
      await expect(uploadProductMedia(2, file)).rejects.toThrow(
        'upload failed',
      );
    });

    it('deleteProductMedia DELETEs the nested media route', async () => {
      stubOnce(jsonResponse(null, 204));
      const { deleteProductMedia } = await load();
      await expect(deleteProductMedia(2, 8)).resolves.toBeUndefined();
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/products/2/media/8`);
    });

    it('deleteProductMedia throws on error', async () => {
      stubOnce(envelope('no media'));
      const { deleteProductMedia } = await load();
      await expect(deleteProductMedia(2, 8)).rejects.toThrow('no media');
    });

    it('reorderProductMedia PUTs ordered_ids and unwraps data.data', async () => {
      stubOnce(jsonResponse({ data: [{ id: 3 }, { id: 1 }] }));
      const { reorderProductMedia } = await load();
      const res = await reorderProductMedia(2, [3, 1]);
      expect(res).toEqual([{ id: 3 }, { id: 1 }]);
      const req = lastRequest();
      expect(req.method).toBe('PUT');
      expect(await req.text()).toBe('{"ordered_ids":[3,1]}');
    });

    it('reorderProductMedia defaults to [] when data is absent', async () => {
      stubOnce(jsonResponse({}));
      const { reorderProductMedia } = await load();
      await expect(reorderProductMedia(2, [])).resolves.toEqual([]);
    });

    it('reorderProductMedia throws on error', async () => {
      stubOnce(envelope('reorder failed'));
      const { reorderProductMedia } = await load();
      await expect(reorderProductMedia(2, [1])).rejects.toThrow(
        'reorder failed',
      );
    });
  });

  // ---------------------------------------------------------------- attributes
  describe('attributes', () => {
    it('listAttributes GETs the attributes route and returns data', async () => {
      stubOnce(jsonResponse([{ id: 1, code: 'color' }]));
      const { listAttributes } = await load();
      await expect(listAttributes()).resolves.toEqual([
        { id: 1, code: 'color' },
      ]);
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/attributes`);
    });

    it('listAttributes defaults to [] when body is null', async () => {
      stubOnce(jsonResponse(null, 200));
      const { listAttributes } = await load();
      await expect(listAttributes()).resolves.toEqual([]);
    });

    it('listAttributes throws on error', async () => {
      stubOnce(envelope('attrs down'));
      const { listAttributes } = await load();
      await expect(listAttributes()).rejects.toThrow('attrs down');
    });

    it('setProductAttributes PUTs the value_ids body to the nested route', async () => {
      stubOnce(jsonResponse({ id: 7, value_ids: [1, 2] }));
      const { setProductAttributes } = await load();
      const res = await setProductAttributes(7, [1, 2]);
      expect(res).toEqual({ id: 7, value_ids: [1, 2] });
      const req = lastRequest();
      expect(req.method).toBe('PUT');
      expect(req.url).toBe(`${BASE}/api/v1/admin/products/7/attributes`);
      expect(await req.text()).toBe('{"value_ids":[1,2]}');
    });

    it('setProductAttributes throws on error', async () => {
      stubOnce(envelope('bad attrs'));
      const { setProductAttributes } = await load();
      await expect(setProductAttributes(7, [1])).rejects.toThrow('bad attrs');
    });
  });

  // ---------------------------------------------------------------- categories
  describe('categories', () => {
    it('listCategories returns data or [] and error-throws', async () => {
      stubOnce(jsonResponse([{ id: 1 }]));
      const { listCategories } = await load();
      await expect(listCategories()).resolves.toEqual([{ id: 1 }]);
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/categories`);
    });

    it('listCategories defaults to [] when body is null', async () => {
      stubOnce(jsonResponse(null, 200));
      const { listCategories } = await load();
      await expect(listCategories()).resolves.toEqual([]);
    });

    it('listCategories throws on error', async () => {
      stubOnce(envelope('cats down'));
      const { listCategories } = await load();
      await expect(listCategories()).rejects.toThrow('cats down');
    });

    it('createCategory POSTs and returns', async () => {
      stubOnce(jsonResponse({ id: 5 }, 201));
      const { createCategory } = await load();
      await expect(createCategory({ name: 'C' } as never)).resolves.toEqual({
        id: 5,
      });
      expect(lastRequest().method).toBe('POST');
    });

    it('createCategory throws on error', async () => {
      stubOnce(envelope('bad cat'));
      const { createCategory } = await load();
      await expect(createCategory({} as never)).rejects.toThrow('bad cat');
    });

    it('updateCategory PATCHes the path route', async () => {
      stubOnce(jsonResponse({ id: 6 }));
      const { updateCategory } = await load();
      await expect(updateCategory(6, {} as never)).resolves.toEqual({ id: 6 });
      const req = lastRequest();
      expect(req.method).toBe('PATCH');
      expect(req.url).toBe(`${BASE}/api/v1/admin/categories/6`);
    });

    it('updateCategory throws on error', async () => {
      stubOnce(envelope('cat save'));
      const { updateCategory } = await load();
      await expect(updateCategory(6, {} as never)).rejects.toThrow('cat save');
    });

    it('setCategoryTranslation PUTs and resolves void', async () => {
      stubOnce(jsonResponse(null, 204));
      const { setCategoryTranslation } = await load();
      await expect(
        setCategoryTranslation(6, {} as never),
      ).resolves.toBeUndefined();
      expect(lastRequest().url).toBe(
        `${BASE}/api/v1/admin/categories/6/translations`,
      );
    });

    it('setCategoryTranslation throws on error', async () => {
      stubOnce(envelope('cat tr'));
      const { setCategoryTranslation } = await load();
      await expect(setCategoryTranslation(6, {} as never)).rejects.toThrow(
        'cat tr',
      );
    });

    it('deleteCategory DELETEs and resolves void', async () => {
      stubOnce(jsonResponse(null, 204));
      const { deleteCategory } = await load();
      await expect(deleteCategory(6)).resolves.toBeUndefined();
      expect(lastRequest().method).toBe('DELETE');
    });

    it('deleteCategory throws on error', async () => {
      stubOnce(envelope('cat del'));
      const { deleteCategory } = await load();
      await expect(deleteCategory(6)).rejects.toThrow('cat del');
    });
  });

  // -------------------------------------------------------------------- orders
  describe('orders', () => {
    it('listOrders returns the page object with query params', async () => {
      stubOnce(
        jsonResponse({
          data: [{ number: 'A1' }],
          total: 1,
          page: 1,
          page_size: 20,
        }),
      );
      const { listOrders } = await load();
      const res = await listOrders({
        status: 'paid',
        q: 'x',
        page: 1,
        page_size: 20,
      });
      expect(res.total).toBe(1);
      const req = lastRequest();
      expect(req.url).toContain('status=paid');
      expect(req.url).toContain('page_size=20');
    });

    it('listOrders throws on error', async () => {
      stubOnce(envelope('orders down'));
      const { listOrders } = await load();
      await expect(listOrders()).rejects.toThrow('orders down');
    });

    it('getOrder fetches by number', async () => {
      stubOnce(jsonResponse({ number: 'A1' }));
      const { getOrder } = await load();
      await expect(getOrder('A1')).resolves.toEqual({ number: 'A1' });
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/orders/A1`);
    });

    it('getOrder throws on 404', async () => {
      stubOnce(envelope('no order', 404));
      const { getOrder } = await load();
      await expect(getOrder('A1')).rejects.toThrow('no order');
    });

    it('transitionOrder POSTs the transition body', async () => {
      stubOnce(jsonResponse({ number: 'A1', status: 'shipped' }));
      const { transitionOrder } = await load();
      const res = await transitionOrder('A1', { to_status: 'shipped' });
      expect(res).toEqual({ number: 'A1', status: 'shipped' });
      const req = lastRequest();
      expect(req.method).toBe('POST');
      expect(req.url).toBe(`${BASE}/api/v1/admin/orders/A1/transition`);
    });

    it('transitionOrder throws on an invalid transition', async () => {
      stubOnce(envelope('bad transition', 409));
      const { transitionOrder } = await load();
      await expect(transitionOrder('A1', {})).rejects.toThrow('bad transition');
    });
  });

  // ----------------------------------------------------------------- customers
  describe('customers', () => {
    it('listCustomers returns the page and sends query', async () => {
      stubOnce(
        jsonResponse({ data: [{ id: 1 }], total: 1, page: 1, page_size: 20 }),
      );
      const { listCustomers } = await load();
      const res = await listCustomers({ q: 'jo', page: 2, page_size: 20 });
      expect(res.data).toEqual([{ id: 1 }]);
      expect(lastRequest().url).toContain('q=jo');
    });

    it('listCustomers throws on error', async () => {
      stubOnce(envelope('cust down'));
      const { listCustomers } = await load();
      await expect(listCustomers()).rejects.toThrow('cust down');
    });

    it('getCustomer fetches by user id', async () => {
      stubOnce(jsonResponse({ id: 42 }));
      const { getCustomer } = await load();
      await expect(getCustomer(42)).resolves.toEqual({ id: 42 });
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/customers/42`);
    });

    it('getCustomer throws on 404', async () => {
      stubOnce(envelope('no cust', 404));
      const { getCustomer } = await load();
      await expect(getCustomer(42)).rejects.toThrow('no cust');
    });
  });

  // ------------------------------------------------------- dashboard/analytics
  describe('dashboard + analytics', () => {
    it('dashboardSummary sends the date range and returns data', async () => {
      stubOnce(jsonResponse({ revenue: '100' }));
      const { dashboardSummary } = await load();
      const res = await dashboardSummary({
        date_from: '2026-01-01',
        date_to: '2026-02-01',
      });
      expect(res).toEqual({ revenue: '100' });
      const req = lastRequest();
      expect(req.url).toContain('date_from=2026-01-01');
      expect(req.url).toContain('/api/v1/admin/dashboard/summary');
    });

    it('dashboardSummary throws on error', async () => {
      stubOnce(envelope('sum down'));
      const { dashboardSummary } = await load();
      await expect(dashboardSummary()).rejects.toThrow('sum down');
    });

    it('revenueSeries returns data', async () => {
      stubOnce(jsonResponse({ points: [] }));
      const { revenueSeries } = await load();
      await expect(revenueSeries()).resolves.toEqual({ points: [] });
      expect(lastRequest().url).toContain(
        '/api/v1/admin/dashboard/revenue-series',
      );
    });

    it('revenueSeries throws on error', async () => {
      stubOnce(envelope('rev down'));
      const { revenueSeries } = await load();
      await expect(revenueSeries()).rejects.toThrow('rev down');
    });

    it('analyticsSummary returns data', async () => {
      stubOnce(jsonResponse({ sessions: 10 }));
      const { analyticsSummary } = await load();
      await expect(analyticsSummary()).resolves.toEqual({ sessions: 10 });
      expect(lastRequest().url).toContain('/api/v1/admin/analytics/summary');
    });

    it('analyticsSummary throws on error', async () => {
      stubOnce(envelope('an down'));
      const { analyticsSummary } = await load();
      await expect(analyticsSummary()).rejects.toThrow('an down');
    });

    it('trafficSeries returns data', async () => {
      stubOnce(jsonResponse({ points: [] }));
      const { trafficSeries } = await load();
      await expect(trafficSeries()).resolves.toEqual({ points: [] });
      expect(lastRequest().url).toContain(
        '/api/v1/admin/analytics/traffic-series',
      );
    });

    it('trafficSeries throws on error', async () => {
      stubOnce(envelope('traffic down'));
      const { trafficSeries } = await load();
      await expect(trafficSeries()).rejects.toThrow('traffic down');
    });
  });

  // ---------------------------------------------------------- staff + seo + cms
  describe('settings + content', () => {
    it('listStaff unwraps data.data or []', async () => {
      stubOnce(jsonResponse({ data: [{ id: 1 }] }));
      const { listStaff } = await load();
      await expect(listStaff()).resolves.toEqual([{ id: 1 }]);
    });

    it('listStaff defaults to [] when body lacks data', async () => {
      stubOnce(jsonResponse({}));
      const { listStaff } = await load();
      await expect(listStaff()).resolves.toEqual([]);
    });

    it('listStaff throws on error', async () => {
      stubOnce(envelope('staff down'));
      const { listStaff } = await load();
      await expect(listStaff()).rejects.toThrow('staff down');
    });

    it('createStaff POSTs and returns', async () => {
      stubOnce(jsonResponse({ id: 2 }, 201));
      const { createStaff } = await load();
      await expect(createStaff({ email: 'a@b.c' } as never)).resolves.toEqual({
        id: 2,
      });
    });

    it('createStaff throws on error', async () => {
      stubOnce(envelope('staff bad'));
      const { createStaff } = await load();
      await expect(createStaff({} as never)).rejects.toThrow('staff bad');
    });

    it('updateStaff PATCHes by user id', async () => {
      stubOnce(jsonResponse({ id: 2, role: 'admin' }));
      const { updateStaff } = await load();
      await expect(updateStaff(2, {} as never)).resolves.toEqual({
        id: 2,
        role: 'admin',
      });
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/staff/2`);
    });

    it('updateStaff throws on error', async () => {
      stubOnce(envelope('staff upd'));
      const { updateStaff } = await load();
      await expect(updateStaff(2, {} as never)).rejects.toThrow('staff upd');
    });

    it('getSeo returns settings', async () => {
      stubOnce(jsonResponse({ title_ru: 'x' }));
      const { getSeo } = await load();
      await expect(getSeo()).resolves.toEqual({ title_ru: 'x' });
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/settings/seo`);
    });

    it('getSeo throws on error', async () => {
      stubOnce(envelope('seo down'));
      const { getSeo } = await load();
      await expect(getSeo()).rejects.toThrow('seo down');
    });

    it('putSeo PUTs and returns', async () => {
      stubOnce(jsonResponse({ title_ru: 'y' }));
      const { putSeo } = await load();
      await expect(putSeo({ title_ru: 'y' } as never)).resolves.toEqual({
        title_ru: 'y',
      });
      expect(lastRequest().method).toBe('PUT');
    });

    it('putSeo throws on error', async () => {
      stubOnce(envelope('seo save'));
      const { putSeo } = await load();
      await expect(putSeo({} as never)).rejects.toThrow('seo save');
    });

    it('listContentPages returns data', async () => {
      stubOnce(jsonResponse([{ id: 1, slug: 'about' }]));
      const { listContentPages } = await load();
      await expect(listContentPages()).resolves.toEqual([
        { id: 1, slug: 'about' },
      ]);
    });

    it('listContentPages throws on error', async () => {
      stubOnce(envelope('pages down'));
      const { listContentPages } = await load();
      await expect(listContentPages()).rejects.toThrow('pages down');
    });

    it('getContentPageAdmin fetches by id', async () => {
      stubOnce(jsonResponse({ id: 3 }));
      const { getContentPageAdmin } = await load();
      await expect(getContentPageAdmin(3)).resolves.toEqual({ id: 3 });
      expect(lastRequest().url).toBe(`${BASE}/api/v1/admin/content-pages/3`);
    });

    it('getContentPageAdmin throws on error', async () => {
      stubOnce(envelope('page down', 404));
      const { getContentPageAdmin } = await load();
      await expect(getContentPageAdmin(3)).rejects.toThrow('page down');
    });

    it('createContentPage POSTs', async () => {
      stubOnce(jsonResponse({ id: 4 }, 201));
      const { createContentPage } = await load();
      await expect(createContentPage({} as never)).resolves.toEqual({ id: 4 });
    });

    it('createContentPage throws on error', async () => {
      stubOnce(envelope('page create'));
      const { createContentPage } = await load();
      await expect(createContentPage({} as never)).rejects.toThrow(
        'page create',
      );
    });

    it('updateContentPage PUTs by id', async () => {
      stubOnce(jsonResponse({ id: 4 }));
      const { updateContentPage } = await load();
      await expect(updateContentPage(4, {} as never)).resolves.toEqual({
        id: 4,
      });
      const req = lastRequest();
      expect(req.method).toBe('PUT');
      expect(req.url).toBe(`${BASE}/api/v1/admin/content-pages/4`);
    });

    it('updateContentPage throws on error', async () => {
      stubOnce(envelope('page save'));
      const { updateContentPage } = await load();
      await expect(updateContentPage(4, {} as never)).rejects.toThrow(
        'page save',
      );
    });

    it('deleteContentPage DELETEs by id', async () => {
      stubOnce(jsonResponse(null, 204));
      const { deleteContentPage } = await load();
      await expect(deleteContentPage(4)).resolves.toBeUndefined();
      expect(lastRequest().method).toBe('DELETE');
    });

    it('deleteContentPage throws on error', async () => {
      stubOnce(envelope('page del'));
      const { deleteContentPage } = await load();
      await expect(deleteContentPage(4)).rejects.toThrow('page del');
    });
  });

  // --------------------------------------------------------------- restock/demand
  describe('restock waiters + demand', () => {
    it('getRestockWaiters returns the count', async () => {
      stubOnce(jsonResponse({ count: 12 }));
      const { getRestockWaiters } = await load();
      await expect(getRestockWaiters(5)).resolves.toBe(12);
      expect(lastRequest().url).toBe(
        `${BASE}/api/v1/admin/products/5/restock-waiters`,
      );
    });

    it('getRestockWaiters returns 0 on error (no throw)', async () => {
      stubOnce(envelope('waiters down', 500));
      const { getRestockWaiters } = await load();
      await expect(getRestockWaiters(5)).resolves.toBe(0);
    });

    it('getRestockDemand sends lang and returns data', async () => {
      stubOnce(jsonResponse([{ product_id: 1, waiters: 3 }]));
      const { getRestockDemand } = await load();
      const res = await getRestockDemand('ru');
      expect(res).toEqual([{ product_id: 1, waiters: 3 }]);
      const req = lastRequest();
      expect(req.url).toContain('/api/v1/admin/restock/demand');
      expect(req.url).toContain('lang=ru');
    });

    it('getRestockDemand defaults lang to ru', async () => {
      stubOnce(jsonResponse([]));
      const { getRestockDemand } = await load();
      await getRestockDemand();
      expect(lastRequest().url).toContain('lang=ru');
    });

    it('getRestockDemand throws on error', async () => {
      stubOnce(envelope('demand down'));
      const { getRestockDemand } = await load();
      await expect(getRestockDemand()).rejects.toThrow('demand down');
    });
  });

  // ------------------------------------------------------------------- promos
  describe('promos', () => {
    it('listPromos unwraps data.data', async () => {
      stubOnce(jsonResponse({ data: [{ id: 1 }, { id: 2 }] }));
      const { listPromos } = await load();
      const res = await listPromos();
      expect(res).toEqual([{ id: 1 }, { id: 2 }]);
      const req = lastRequest();
      expect(req.url).toContain('/api/v1/admin/promo');
      expect(req.credentials).toBe('include');
    });

    it('createPromo POSTs the coupon body', async () => {
      stubOnce(jsonResponse({ id: 5 }, 200));
      const { createPromo } = await load();
      const body = {
        code: 'SALE10',
        discount_type: 'percent',
        discount_value: '10',
        active_from: '2026-01-01T00:00:00Z',
        active_to: '2026-12-31T00:00:00Z',
        min_order_total: null,
        usage_limit: null,
        is_active: true,
      };
      const res = await createPromo(body);
      expect(res).toEqual({ id: 5 });
      const req = lastRequest();
      expect(req.method).toBe('POST');
      expect(await req.text()).toBe(JSON.stringify(body));
    });

    it('updatePromo PATCHes the id path', async () => {
      stubOnce(jsonResponse({ id: 5 }, 200));
      const { updatePromo } = await load();
      await updatePromo(5, { is_active: false });
      const req = lastRequest();
      expect(req.method).toBe('PATCH');
      expect(req.url).toContain('/api/v1/admin/promo/5');
      expect(await req.text()).toBe('{"is_active":false}');
    });

    it('deletePromo DELETEs the id path', async () => {
      stubOnce(jsonResponse(null, 204));
      const { deletePromo } = await load();
      await deletePromo(5);
      const req = lastRequest();
      expect(req.method).toBe('DELETE');
      expect(req.url).toContain('/api/v1/admin/promo/5');
    });

    it('listPromos throws on error', async () => {
      stubOnce(envelope('promo down'));
      const { listPromos } = await load();
      await expect(listPromos()).rejects.toThrow('promo down');
    });
  });
});
