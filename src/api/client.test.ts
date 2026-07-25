import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `client.ts` is a thin factory: `createClient<paths>({ baseUrl: API_BASE })`.
// We exercise it through a real GET/POST so the underlying openapi-fetch request
// pipeline (URL join, JSON parse, empty body, error envelope) is covered end to
// end against a stubbed global fetch.

const BASE = 'http://localhost:58000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadClient() {
  return import('./client');
}

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is bound to the configured base URL and parses JSON success bodies', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadClient();

    const { data, error } = await api.GET('/api/v1/site/seo' as never);

    expect(error).toBeUndefined();
    expect(data).toEqual({ ok: true });
    const req = (fetchMock.mock.calls[0] as unknown[])[0] as Request;
    expect(req.url).toBe(`${BASE}/api/v1/site/seo`);
    expect(req.method).toBe('GET');
  });

  it('returns the error envelope for a non-2xx JSON response', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { code: 'E', message: 'nope' } }, 400),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadClient();

    const { data, error } = await api.GET('/api/v1/site/seo' as never);

    expect(data).toBeUndefined();
    expect(error).toEqual({ error: { code: 'E', message: 'nope' } });
  });

  it('yields no data for an empty (204) body', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadClient();

    const { data, error } = await api.POST(
      '/api/v1/auth/logout' as never,
      {
        credentials: 'include',
      } as never,
    );

    expect(error).toBeUndefined();
    expect(data).toBeUndefined();
  });

  it('propagates a network-level throw', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network down');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadClient();

    await expect(api.GET('/api/v1/site/seo' as never)).rejects.toThrow(
      'network down',
    );
  });
});

function resp(status: number): Response {
  return new Response(null, { status });
}

describe('retryFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a GET on 502 and returns the eventual success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(502))
      .mockResolvedValueOnce(resp(200));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    const res = await retryFetch('/x'); // no method → GET
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget and returns the last 5xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(503));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    const res = await retryFetch('/x');
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('retries a GET on a network error, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(resp(200));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    const res = await retryFetch('/x');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a POST (writes must not double-submit)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(502));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    const res = await retryFetch('/x', { method: 'POST' });
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a successful GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    await retryFetch('/x');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads the method from a GET Request object and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(502))
      .mockResolvedValueOnce(resp(200));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    const res = await retryFetch(new Request('http://x/y'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a POST Request object', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(502));
    vi.stubGlobal('fetch', fetchMock);
    const { retryFetch } = await import('./client');

    const res = await retryFetch(new Request('http://x/y', { method: 'POST' }));
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
