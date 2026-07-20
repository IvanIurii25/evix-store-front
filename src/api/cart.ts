import { api } from './client';
import type { components } from '../types/api';

export type CartOut = components['schemas']['CartOut'];
export type CartItemOut = components['schemas']['CartItemOut'];

const EMPTY: CartOut = { items: [], subtotal: '0', item_count: 0 };

// Cart writes go to the backend (guest cart via session_token cookie set by the
// backend; `credentials: include` so the cookie round-trips).

export async function getCart(): Promise<CartOut> {
  const { data } = await api.GET('/api/v1/cart', { credentials: 'include' });
  return data ?? EMPTY;
}

export async function addToCart(productId: number, qty: number) {
  const { data, error, response } = await api.POST('/api/v1/cart/items', {
    body: { product_id: productId, qty },
    credentials: 'include',
  });
  if (error) throw new Error(`addToCart failed (${response.status})`);
  return data;
}

export async function updateItem(productId: number, qty: number) {
  await api.PATCH('/api/v1/cart/items/{product_id}', {
    params: { path: { product_id: productId } },
    body: { qty },
    credentials: 'include',
  });
}

export async function removeItem(productId: number) {
  await api.DELETE('/api/v1/cart/items/{product_id}', {
    params: { path: { product_id: productId } },
    credentials: 'include',
  });
}

// Merge the guest cart (session_token cookie) into the user cart after login.
export async function mergeCart() {
  await api.POST('/api/v1/cart/merge', { credentials: 'include' });
}
