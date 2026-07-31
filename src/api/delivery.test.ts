import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubOnce(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

// A Response body can only be read once, so a test making two calls needs a
// fresh one per call.
function stubAlways(factory: () => Response) {
  fetchMock = vi.fn(async () => factory());
  vi.stubGlobal('fetch', fetchMock);
}

function req(): Request {
  return fetchMock.mock.calls[0][0] as Request;
}

async function load() {
  return import('./delivery');
}

describe('delivery api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps the method list, filling absent optional fields', async () => {
    stubOnce(
      jsonResponse({
        novapost_enabled: true,
        methods: [
          { service: 'own', type: 'pickup', flat_cost: '0' },
          {
            service: 'novapost',
            type: 'courier',
            free_from: '500',
            address_fields: [{ name: 'city', required: true, max_length: 100 }],
          },
        ],
      }),
    );
    const { listDeliveryMethods } = await load();

    const res = await listDeliveryMethods();

    expect(res.novapost_enabled).toBe(true);
    expect(res.methods[0]).toEqual({
      service: 'own',
      type: 'pickup',
      flat_cost: '0',
      free_from: null,
      address_fields: [],
    });
    // Labels missing from the payload become empty strings rather than
    // undefined, so the form never renders "undefined" as a placeholder.
    expect(res.methods[1].address_fields[0]).toEqual({
      name: 'city',
      required: true,
      max_length: 100,
      label_ru: '',
      label_ro: '',
    });
  });

  it('degrades to "carrier off" when the call fails', async () => {
    stubOnce(jsonResponse({ error: { code: 'E' } }, 500));
    const { listDeliveryMethods } = await load();

    // A failed lookup must leave the customer with pickup and our own courier,
    // not with an error page.
    expect(await listDeliveryMethods()).toEqual({
      methods: [],
      novapost_enabled: false,
    });
  });

  it('posts the settlement query with the language', async () => {
    stubOnce(jsonResponse({ data: [{ id: 's-1', name: 'Chișinău' }] }));
    const { searchSettlements } = await load();

    const rows = await searchSettlements('chi', 'ru');

    expect(rows).toEqual([{ id: 's-1', name: 'Chișinău' }]);
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toContain('/api/v1/delivery/novapost/settlements');
    expect(r.url).toContain('lang=ru');
    expect(JSON.parse(await r.text())).toEqual({ query: 'chi' });
  });

  it('posts the division query with settlement and category', async () => {
    stubOnce(jsonResponse({ data: [] }));
    const { listDivisions } = await load();

    await listDivisions('s-1', 'postomat', 'dacia', 'ro');

    expect(JSON.parse(await req().text())).toEqual({
      settlement_id: 's-1',
      category: 'postomat',
      query: 'dacia',
    });
  });

  it('returns an empty list when a lookup fails', async () => {
    stubAlways(() => jsonResponse({ error: { code: 'E' } }, 502));
    const { searchSettlements, listDivisions } = await load();

    expect(await searchSettlements('x')).toEqual([]);
    expect(await listDivisions('s-1', 'branch', '')).toEqual([]);
  });

  it('tolerates a response without a data array', async () => {
    stubOnce(jsonResponse({}));
    const { searchSettlements } = await load();

    expect(await searchSettlements('x')).toEqual([]);
  });
});
