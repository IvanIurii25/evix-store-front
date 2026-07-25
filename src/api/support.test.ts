import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// support.ts wraps the shared openapi-fetch client (list/thread/reply/status) plus
// a native EventSource live feed. For the fetch wrappers we stub global fetch and
// assert the built Request; for the SSE feed we stub global EventSource.

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
  return import('./support');
}

function stubOnce(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function lastRequest(): Request {
  return fetchMock.mock.calls[0][0] as Request;
}

describe('support api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('listConversations GETs the envelope with the status filter', async () => {
    stubOnce(
      jsonResponse({ data: [{ id: 1 }], total: 1, page: 1, page_size: 20 }),
    );
    const { listConversations } = await load();
    const res = await listConversations({ status: 'open', page: 2 });
    expect(res.total).toBe(1);
    const req = lastRequest();
    expect(req.method).toBe('GET');
    expect(req.credentials).toBe('include');
    expect(req.url).toBe(
      `${BASE}/api/v1/admin/support/conversations?status=open&page=2`,
    );
  });

  it('listConversations throws the envelope message on error', async () => {
    stubOnce(envelope('нет доступа', 403));
    const { listConversations } = await load();
    await expect(listConversations()).rejects.toThrow('нет доступа');
  });

  it('getThread GETs one conversation with its page', async () => {
    stubOnce(
      jsonResponse({
        conversation: { id: 7 },
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        page_size: 50,
      }),
    );
    const { getThread } = await load();
    const res = await getThread(7, 1);
    expect(res.conversation.id).toBe(7);
    expect(lastRequest().url).toBe(
      `${BASE}/api/v1/admin/support/conversations/7?page=1`,
    );
  });

  it('replyToConversation POSTs the text body', async () => {
    stubOnce(jsonResponse({ id: 99, direction: 'out', text: 'hi' }, 200));
    const { replyToConversation } = await load();
    const res = await replyToConversation(7, 'hi');
    expect(res.id).toBe(99);
    const req = lastRequest();
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE}/api/v1/admin/support/conversations/7/reply`);
    expect(await req.text()).toBe('{"text":"hi"}');
  });

  it('replyToConversation throws on error', async () => {
    stubOnce(envelope('диалог не найден', 404));
    const { replyToConversation } = await load();
    await expect(replyToConversation(1, 'x')).rejects.toThrow(
      'диалог не найден',
    );
  });

  it('setConversationStatus POSTs the status body', async () => {
    stubOnce(jsonResponse({ id: 7, status: 'closed' }, 200));
    const { setConversationStatus } = await load();
    const res = await setConversationStatus(7, 'closed');
    expect(res.status).toBe('closed');
    const req = lastRequest();
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE}/api/v1/admin/support/conversations/7/status`);
    expect(await req.text()).toBe('{"status":"closed"}');
  });

  it('setConversationStatus throws on error', async () => {
    stubOnce(envelope('нельзя', 422));
    const { setConversationStatus } = await load();
    await expect(setConversationStatus(1, 'bad')).rejects.toThrow('нельзя');
  });

  it('falls back to the default message when the envelope has none', async () => {
    stubOnce(jsonResponse({ error: { code: 'X' } }, 500));
    const { listConversations } = await load();
    await expect(listConversations()).rejects.toThrow(
      'Не удалось загрузить диалоги',
    );
  });

  it('getThread defaults to page 1 when omitted', async () => {
    stubOnce(
      jsonResponse({
        conversation: { id: 3 },
        data: [],
        total: 0,
        page: 1,
        page_size: 50,
      }),
    );
    const { getThread } = await load();
    await getThread(3);
    expect(lastRequest().url).toBe(
      `${BASE}/api/v1/admin/support/conversations/3?page=1`,
    );
  });
});

interface FakeSource {
  url: string;
  opts: unknown;
  onmessage: ((e: MessageEvent<string>) => void) | null;
  close: () => void;
}

describe('subscribeSupport', () => {
  beforeEach(() => {
    vi.resetModules();
    class FakeEventSource {
      onmessage: ((e: MessageEvent<string>) => void) | null = null;
      close = vi.fn();
      constructor(
        public url: string,
        public opts?: unknown,
      ) {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the stream with credentials and forwards parsed events', async () => {
    const { subscribeSupport } = await load();
    const onEvent = vi.fn();
    const src = subscribeSupport(onEvent) as unknown as FakeSource;
    expect(src.url).toBe(`${BASE}/api/v1/admin/support/conversations/stream`);
    expect(src.opts).toEqual({ withCredentials: true });

    src.onmessage!({
      data: JSON.stringify({ conversation_id: 5, kind: 'inbound' }),
    } as MessageEvent<string>);
    expect(onEvent).toHaveBeenCalledWith({
      conversation_id: 5,
      kind: 'inbound',
    });

    // malformed frame (e.g. the ": connected" comment) is ignored, never throws
    src.onmessage!({
      data: 'not-json',
    } as MessageEvent<string>);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
