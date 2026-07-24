import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MiddlewareHandler } from 'astro';

// --- Mock Astro virtual modules --------------------------------------------- //

// astro:i18n exports a `middleware(opts)` factory returning a handler. We stub it
// with a spy handler so we can assert the storefront path was delegated to it.
const i18nHandler = vi.fn((_ctx: unknown, next: () => unknown) => next());
const i18nFactory = vi.fn((opts?: unknown) => {
  void opts;
  return i18nHandler;
});
vi.mock('astro:i18n', () => ({
  middleware: (o: unknown) => i18nFactory(o),
}));

// astro:middleware's `sequence` composes handlers left→right; reimplement it so
// onRequest actually runs both i18nRouting and analytics in order.
vi.mock('astro:middleware', () => ({
  sequence: (...handlers: MiddlewareHandler[]): MiddlewareHandler =>
    ((context, next) => {
      const run = (i: number): unknown =>
        i >= handlers.length
          ? next()
          : handlers[i](context, () => run(i + 1) as never);
      return run(0);
    }) as MiddlewareHandler,
}));

vi.mock('./config/env', () => ({ API_BASE: 'http://api.test' }));

// Import after mocks are registered.
const { onRequest } = await import('./middleware');

// --- Context builder --------------------------------------------------------- //

interface CtxOpts {
  path?: string;
  method?: string;
  clientAddress?: string | undefined;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

function makeCtx(opts: CtxOpts = {}) {
  const { path = '/ro', method = 'GET', cookies = {}, headers = {} } = opts;
  // Distinguish "not provided" (default IP) from an explicit `undefined`.
  const clientAddress =
    'clientAddress' in opts ? opts.clientAddress : '10.0.0.5';
  const store = new Map(Object.entries(cookies));
  const setCalls: Array<{ name: string; value: string; opts: unknown }> = [];
  const context = {
    url: new URL(`https://shop.evix.md${path}`),
    clientAddress,
    request: {
      method,
      headers: { get: (k: string) => headers[k] ?? null },
    },
    cookies: {
      get: (name: string) =>
        store.has(name) ? { value: store.get(name) } : undefined,
      set: (name: string, value: string, o: unknown) => {
        setCalls.push({ name, value, opts: o });
        store.set(name, value);
      },
    },
  };
  return { context, setCalls };
}

const okResponse = () => new Response('ok');

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  i18nHandler.mockClear();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onRequest — i18n routing', () => {
  it('passes /admin straight through without invoking i18n', async () => {
    const next = vi.fn(async () => okResponse());
    const { context } = makeCtx({ path: '/admin/orders' });
    const res = await onRequest(context as never, next as never);
    expect(await (res as Response).text()).toBe('ok');
    expect(i18nHandler).not.toHaveBeenCalled();
    // /admin is not trackable → no analytics fetch
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delegates storefront paths to the astro i18n handler', async () => {
    const next = vi.fn(async () => okResponse());
    const { context } = makeCtx({ path: '/ro', cookies: { sid: 'x' } });
    await onRequest(context as never, next as never);
    expect(i18nHandler).toHaveBeenCalledTimes(1);
  });
});

describe('onRequest — analytics', () => {
  it('skips tracking for non-GET requests', async () => {
    const next = vi.fn(async () => okResponse());
    const { context } = makeCtx({ path: '/ro', method: 'POST' });
    await onRequest(context as never, next as never);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips loopback client addresses (healthcheck)', async () => {
    for (const addr of ['::1', '127.0.0.1', '::ffff:127.0.0.1']) {
      fetchMock.mockClear();
      const next = vi.fn(async () => okResponse());
      const { context } = makeCtx({ path: '/ro', clientAddress: addr });
      await onRequest(context as never, next as never);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('skips API, asset, favicon and file-like paths', async () => {
    for (const p of [
      '/api/v1/x',
      '/_astro/a.js',
      '/favicon.svg',
      '/ro/logo.png',
    ]) {
      fetchMock.mockClear();
      const next = vi.fn(async () => okResponse());
      const { context } = makeCtx({ path: p });
      await onRequest(context as never, next as never);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('mints a sid cookie and fires a pageview for a fresh visitor', async () => {
    const next = vi.fn(async () => okResponse());
    const { context, setCalls } = makeCtx({
      path: '/ru/search',
      cookies: { evix_consent: '1:all' },
      headers: { 'User-Agent': 'UA', Referer: 'https://g.co' },
    });
    await onRequest(context as never, next as never);

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].name).toBe('sid');
    expect(setCalls[0].value).toMatch(/[0-9a-f-]{36}/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/track/pageview');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Forwarded-For']).toBe('10.0.0.5');
    expect(headers['User-Agent']).toBe('UA');
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.path).toBe('/ru/search');
    expect(body.referrer).toBe('https://g.co');
    expect(body.session_id).toBe(setCalls[0].value);
  });

  it('reuses an existing sid and forwards a bearer when access cookie set', async () => {
    const next = vi.fn(async () => okResponse());
    const { context, setCalls } = makeCtx({
      path: '/ro',
      cookies: { sid: 'existing-sid', access: 'tok', evix_consent: '1:all' },
    });
    await onRequest(context as never, next as never);

    expect(setCalls).toHaveLength(0); // no new cookie minted
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.session_id).toBe('existing-sid');
    expect(body.referrer).toBeNull();
  });

  it('forwards an empty XFF when clientAddress is undefined', async () => {
    const next = vi.fn(async () => okResponse());
    const { context } = makeCtx({
      path: '/ro',
      clientAddress: undefined,
      cookies: { evix_consent: '1:all' },
    });
    await onRequest(context as never, next as never);
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Forwarded-For']).toBe('');
    expect(headers['User-Agent']).toBe('');
  });

  it('swallows fetch rejections (analytics never breaks the page)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    const next = vi.fn(async () => okResponse());
    const { context } = makeCtx({
      path: '/ro',
      cookies: { evix_consent: '1:all' },
    });
    await expect(
      onRequest(context as never, next as never),
    ).resolves.toBeInstanceOf(Response);
  });

  it('does not set a sid or fire a pageview without analytics consent', async () => {
    for (const cookies of [
      {}, // no decision yet
      { evix_consent: '1:necessary' }, // rejected analytics
      { evix_consent: '0:all' }, // stale policy version → re-prompt
    ]) {
      fetchMock.mockClear();
      const next = vi.fn(async () => okResponse());
      const { context, setCalls } = makeCtx({ path: '/ro', cookies });
      await onRequest(context as never, next as never);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(setCalls.find((c) => c.name === 'sid')).toBeUndefined();
    }
  });
});
