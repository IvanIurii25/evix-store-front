// Typed admin API wrappers for the Telegram support inbox.
//
// Same posture as `admin.ts`: calls run from the admin Vue island in the browser
// with the httpOnly `access` cookie, so every request sends
// `credentials: 'include'`; errors arrive in the unified
// `{ error: { code, message } }` envelope and `fail()` rethrows the message.
//
// The live feed is Server-Sent Events (`/stream`), consumed via a native
// EventSource in `subscribeSupport` — one-directional server→client, cookies
// carried by `withCredentials` (same-origin in prod; CORS-credentials in dev).
import { api } from './client';
import { API_BASE } from '../config/env';
import type { components } from '../types/api';

type Schemas = components['schemas'];

export type ConversationOut = Schemas['ConversationOut'];
export type MessageOut = Schemas['MessageOut'];
export type ConversationList = Schemas['ConversationList'];
export type ThreadOut = Schemas['ThreadOut'];
export type CannedOut = Schemas['CannedOut'];
export type CannedIn = Schemas['CannedIn'];
export type LinkedOrderOut = Schemas['LinkedOrderOut'];

// One live event pushed over SSE: which conversation changed and how.
export interface SupportEvent {
  conversation_id: number;
  kind: 'inbound' | 'outbound' | 'status';
}

const CREDS = { credentials: 'include' as const };

type ErrorBody = { error?: { code?: string; message?: string } };

function fail(error: unknown, fallback: string): never {
  const body = error as ErrorBody | undefined;
  throw new Error(body?.error?.message ?? fallback);
}

export interface ConversationFilters {
  status?: string | null;
  page?: number;
}

export async function listConversations(
  filters: ConversationFilters = {},
): Promise<ConversationList> {
  const { data, error } = await api.GET('/api/v1/admin/support/conversations', {
    params: { query: filters },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить диалоги');
  return data as ConversationList;
}

export async function getThread(
  conversationId: number,
  page = 1,
): Promise<ThreadOut> {
  const { data, error } = await api.GET(
    '/api/v1/admin/support/conversations/{conversation_id}',
    {
      params: { path: { conversation_id: conversationId }, query: { page } },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Диалог не найден');
  return data as ThreadOut;
}

export async function replyToConversation(
  conversationId: number,
  text: string,
): Promise<MessageOut> {
  const { data, error } = await api.POST(
    '/api/v1/admin/support/conversations/{conversation_id}/reply',
    {
      params: { path: { conversation_id: conversationId } },
      body: { text },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось отправить ответ');
  return data as MessageOut;
}

export async function setConversationStatus(
  conversationId: number,
  status: string,
): Promise<ConversationOut> {
  const { data, error } = await api.POST(
    '/api/v1/admin/support/conversations/{conversation_id}/status',
    {
      params: { path: { conversation_id: conversationId } },
      body: { status },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось изменить статус');
  return data as ConversationOut;
}

// On-request erasure (LP195/2024 Art.17): hard-delete a conversation and its
// messages. Telegram support data is not account-linked, so this is the manual
// erasure path an operator actions on a subject's request.
export async function deleteConversation(
  conversationId: number,
): Promise<void> {
  const { error } = await api.DELETE(
    '/api/v1/admin/support/conversations/{conversation_id}',
    { params: { path: { conversation_id: conversationId } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось удалить диалог');
}

// Open the SSE live feed. Returns the EventSource so the caller closes it on
// teardown. `onEvent` fires per pushed conversation-changed event; malformed
// frames (and the initial `: connected` comment) are ignored.
export function subscribeSupport(
  onEvent: (event: SupportEvent) => void,
): EventSource {
  const source = new EventSource(
    `${API_BASE}/api/v1/admin/support/conversations/stream`,
    { withCredentials: true },
  );
  source.onmessage = (msg: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(msg.data) as SupportEvent);
    } catch {
      // ignore non-JSON keepalive/comment frames
    }
  };
  return source;
}

// --------------------------------------------------------------------------- //
// Canned responses (reply templates) — admin CRUD
// --------------------------------------------------------------------------- //
export async function listCanned(lang?: string): Promise<CannedOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/support/canned', {
    params: { query: lang ? { lang } : {} },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить шаблоны');
  return data ?? [];
}

export async function createCanned(body: CannedIn): Promise<CannedOut> {
  const { data, error } = await api.POST('/api/v1/admin/support/canned', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать шаблон');
  return data as CannedOut;
}

export async function updateCanned(
  cannedId: number,
  body: CannedIn,
): Promise<CannedOut> {
  const { data, error } = await api.PATCH(
    '/api/v1/admin/support/canned/{canned_id}',
    { params: { path: { canned_id: cannedId } }, body, ...CREDS },
  );
  if (error) fail(error, 'Не удалось сохранить шаблон');
  return data as CannedOut;
}

export async function deleteCanned(cannedId: number): Promise<void> {
  const { error } = await api.DELETE(
    '/api/v1/admin/support/canned/{canned_id}',
    { params: { path: { canned_id: cannedId } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось удалить шаблон');
}

// --------------------------------------------------------------------------- //
// Order link — attach/detach an order to a conversation for operator context
// --------------------------------------------------------------------------- //
export async function linkOrder(
  conversationId: number,
  orderNumber: string,
): Promise<LinkedOrderOut> {
  const { data, error } = await api.POST(
    '/api/v1/admin/support/conversations/{conversation_id}/link',
    {
      params: { path: { conversation_id: conversationId } },
      body: { order_number: orderNumber },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Заказ не найден');
  return data as LinkedOrderOut;
}

export async function unlinkOrder(conversationId: number): Promise<void> {
  const { error } = await api.DELETE(
    '/api/v1/admin/support/conversations/{conversation_id}/link',
    { params: { path: { conversation_id: conversationId } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось отвязать заказ');
}
