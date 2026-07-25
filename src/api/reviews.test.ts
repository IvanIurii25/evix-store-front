import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const BASE = 'http://localhost:58000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(status: number): Response {
  return jsonResponse({ error: { code: 'E', message: 'boom' } }, status);
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
  return import('./reviews');
}

const AGG = {
  average: 4.3,
  count: 12,
  distribution: { '5': 8, '4': 2, '3': 1, '2': 0, '1': 1 },
};

describe('reviews api', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getProductReviews returns aggregate + data and forwards sort/cursor/lang', async () => {
    stubOnce(jsonResponse({ aggregate: AGG, data: [], next_cursor: 'c2' }));
    const { getProductReviews } = await load();
    const res = await getProductReviews('cam', {
      lang: 'ru',
      sort: 'highest',
      cursor: 'c1',
    });
    expect(res.aggregate.average).toBe(4.3);
    expect(res.next_cursor).toBe('c2');
    const r = req();
    expect(r.url).toContain('/api/v1/catalog/products/cam/reviews');
    expect(r.url).toContain('sort=highest');
    expect(r.url).toContain('cursor=c1');
    expect(r.url).toContain('lang=ru');
  });

  it('getProductReviews falls back to an empty aggregate on error', async () => {
    stubOnce(envelope(500));
    const { getProductReviews } = await load();
    const res = await getProductReviews('cam', { lang: 'ru' });
    expect(res.aggregate.count).toBe(0);
    expect(res.aggregate.average).toBeNull();
    expect(res.data).toEqual([]);
  });

  it('submitReview POSTs the review and returns ok with the created review', async () => {
    stubOnce(jsonResponse({ id: 1, status: 'pending', is_verified: true }));
    const { submitReview } = await load();
    const res = await submitReview({
      productId: 7,
      rating: 5,
      title: 'Great',
      body: 'Loved it',
      authorName: 'Ana',
      lang: 'ru',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.review.status).toBe('pending');
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.credentials).toBe('include');
    const sent = JSON.parse(await r.text());
    expect(sent).toEqual({
      product_id: 7,
      rating: 5,
      title: 'Great',
      body: 'Loved it',
      author_name: 'Ana',
      lang: 'ru',
    });
  });

  it('submitReview nulls out omitted optional fields', async () => {
    stubOnce(jsonResponse({ id: 1, status: 'pending', is_verified: false }));
    const { submitReview } = await load();
    await submitReview({ productId: 7, rating: 4, lang: 'ro' });
    const sent = JSON.parse(await req().text());
    expect(sent.title).toBeNull();
    expect(sent.body).toBeNull();
    expect(sent.author_name).toBeNull();
  });

  it('submitReview reports guest on 401', async () => {
    stubOnce(envelope(401));
    const { submitReview } = await load();
    const res = await submitReview({ productId: 7, rating: 5, lang: 'ru' });
    expect(res).toEqual({ ok: false, reason: 'guest' });
  });

  it('submitReview surfaces the server message on other errors', async () => {
    stubOnce(envelope(422));
    const { submitReview } = await load();
    const res = await submitReview({ productId: 7, rating: 5, lang: 'ru' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('error');
      expect(res.message).toBe('boom');
    }
  });

  it('getMyReview returns the review when present', async () => {
    stubOnce(jsonResponse({ id: 3, rating: 4, status: 'approved' }));
    const { getMyReview } = await load();
    const res = await getMyReview(7);
    expect(res.authed).toBe(true);
    if (res.authed) expect(res.review?.id).toBe(3);
  });

  it('getMyReview maps 404 to authed with no review', async () => {
    stubOnce(envelope(404));
    const { getMyReview } = await load();
    const res = await getMyReview(7);
    expect(res).toEqual({ authed: true, review: null });
  });

  it('getMyReview maps 401 to guest', async () => {
    stubOnce(envelope(401));
    const { getMyReview } = await load();
    const res = await getMyReview(7);
    expect(res).toEqual({ authed: false });
  });

  it('deleteMyReview DELETEs the review by id', async () => {
    stubOnce(jsonResponse(null, 204));
    const { deleteMyReview } = await load();
    await deleteMyReview(9);
    const r = req();
    expect(r.method).toBe('DELETE');
    expect(r.url).toBe(`${BASE}/api/v1/reviews/9`);
    expect(r.credentials).toBe('include');
  });
});
