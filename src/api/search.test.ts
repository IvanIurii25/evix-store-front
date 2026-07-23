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

function url(): string {
  return (fetchMock.mock.calls[0][0] as Request).url;
}

async function load() {
  return import('./search');
}

describe('search api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('search returns hits and sends q/lang/page', async () => {
    stubOnce(
      jsonResponse({ data: [{ id: 1 }], total: 1, page: 2, page_size: 20 }),
    );
    const { search } = await load();
    const res = await search('lamp', 'ru', 2);
    expect(res).toEqual({ data: [{ id: 1 }], total: 1, page: 2, page_size: 20 });
    const u = url();
    expect(u).toContain('/api/v1/search');
    expect(u).toContain('q=lamp');
    expect(u).toContain('lang=ru');
    expect(u).toContain('page=2');
  });

  it('search defaults page to 1', async () => {
    stubOnce(jsonResponse({ data: [], total: 0, page: 1, page_size: 20 }));
    const { search } = await load();
    await search('x', 'ru');
    expect(url()).toContain('page=1');
  });

  it('search returns an empty result set on error, echoing the page', async () => {
    stubOnce(envelope(500));
    const { search } = await load();
    await expect(search('x', 'ru', 3)).resolves.toEqual({
      data: [],
      total: 0,
      page: 3,
      page_size: 0,
    });
  });
});
