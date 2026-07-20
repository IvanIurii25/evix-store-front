import { api } from './client';

// Cart writes go to the backend (guest cart via session_token cookie set by the
// backend; `credentials: include` so the cookie round-trips). Full cart page = F5.

export async function addToCart(productId: number, qty: number) {
  const { data, error, response } = await api.POST('/api/v1/cart/items', {
    body: { product_id: productId, qty },
    credentials: 'include',
  });
  if (error) throw new Error(`addToCart failed (${response.status})`);
  return data;
}
