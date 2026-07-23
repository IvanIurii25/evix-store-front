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
    const req = fetchMock.mock.calls[0][0] as Request;
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
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadClient();

    const { data, error } = await api.POST('/api/v1/auth/logout' as never, {
      credentials: 'include',
    } as never);

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
