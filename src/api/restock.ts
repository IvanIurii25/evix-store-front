import { api } from './client';

// Restock ("notify when back in stock") subscriptions. All calls carry the
// httpOnly `access` cookie (`credentials: include`); a 401 means the visitor is
// a guest — the caller then routes them through login.

export interface RestockStatus {
  authed: boolean;
  subscribed: boolean;
}

export async function getRestockStatus(
  productId: number,
): Promise<RestockStatus> {
  const { data, error, response } = await api.GET(
    '/api/v1/restock/subscriptions/{product_id}',
    { params: { path: { product_id: productId } }, credentials: 'include' },
  );
  if (response.status === 401) return { authed: false, subscribed: false };
  if (error || !data) return { authed: true, subscribed: false };
  return { authed: true, subscribed: Boolean(data.subscribed) };
}

export type SubscribeResult = 'ok' | 'guest' | 'error';

export async function subscribeRestock(
  productId: number,
  lang: string,
): Promise<SubscribeResult> {
  const { error, response } = await api.POST('/api/v1/restock/subscriptions', {
    body: { product_id: productId, lang },
    credentials: 'include',
  });
  if (response.status === 401) return 'guest';
  if (error) return 'error';
  return 'ok';
}

export async function unsubscribeRestock(productId: number): Promise<void> {
  await api.DELETE('/api/v1/restock/subscriptions/{product_id}', {
    params: { path: { product_id: productId } },
    credentials: 'include',
  });
}
