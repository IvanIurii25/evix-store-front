import { api } from './client';
import type { components } from '../types/api';

export type CartOut = components['schemas']['CartOut'];
export type CartItemOut = components['schemas']['CartItemOut'];

const EMPTY: CartOut = { items: [], subtotal: '0', item_count: 0 };

// Cart writes go to the backend (guest cart via session_token cookie set by the
// backend; `credentials: include` so the cookie round-trips). `lang` selects the
// language of the returned item names (defaults to the backend default when
// omitted); pass it wherever the names are shown.

export async function getCart(lang?: string): Promise<CartOut> {
  const { data } = await api.GET('/api/v1/cart', {
    params: { query: { lang } },
    credentials: 'include',
  });
  return data ?? EMPTY;
}

export async function addToCart(productId: number, qty: number, lang?: string) {
  const { data, error, response } = await api.POST('/api/v1/cart/items', {
    params: { query: { lang } },
    body: { product_id: productId, qty },
    credentials: 'include',
  });
  if (error) throw new Error(`addToCart failed (${response.status})`);
  return data;
}

export async function updateItem(productId: number, qty: number, lang?: string) {
  await api.PATCH('/api/v1/cart/items/{product_id}', {
    params: { path: { product_id: productId }, query: { lang } },
    body: { qty },
    credentials: 'include',
  });
}

export async function removeItem(productId: number, lang?: string) {
  await api.DELETE('/api/v1/cart/items/{product_id}', {
    params: { path: { product_id: productId }, query: { lang } },
    credentials: 'include',
  });
}

// Merge the guest cart (session_token cookie) into the user cart after login.
export async function mergeCart() {
  await api.POST('/api/v1/cart/merge', { credentials: 'include' });
}
