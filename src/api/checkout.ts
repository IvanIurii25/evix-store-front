import { api } from './client';
import { API_BASE } from '../config/env';
import type { components } from '../types/api';

export type QuoteOut = components['schemas']['QuoteOut'];
export type OrderOut = components['schemas']['OrderOut'];
export type DeliveryAddressIn = components['schemas']['DeliveryAddressIn'];

export async function quote(
  deliveryType: string,
  deliveryAddress?: DeliveryAddressIn | null,
  lang?: string,
  deliveryAddressId?: number | null,
): Promise<QuoteOut | null> {
  const { data, error } = await api.POST('/api/v1/checkout/quote', {
    params: { query: { lang } },
    body: {
      delivery_type: deliveryType,
      delivery_address: deliveryAddress ?? null,
      delivery_address_id: deliveryAddressId ?? null,
    },
    credentials: 'include',
  });
  if (error || !data) return null;
  return data;
}

export async function checkout(
  body: {
    email: string;
    phone: string;
    delivery_type: string;
    delivery_address?: DeliveryAddressIn | null;
    delivery_address_id?: number | null;
  },
  lang?: string,
): Promise<OrderOut> {
  const { data, error, response } = await api.POST('/api/v1/checkout', {
    params: { query: { lang } },
    body,
    credentials: 'include',
  });
  if (error || !data) {
    const msg =
      response.status === 400
        ? 'Корзина пуста'
        : response.status === 422
          ? 'Проверьте данные доставки'
          : response.status === 409
            ? 'Товара нет в наличии'
            : 'Не удалось оформить заказ';
    throw new Error(msg);
  }
  return data;
}

// Guest order lookup posts the email in the request body (never the URL) so it
// is not captured in access logs or browser history (LP195/2024 — no PII in
// URLs). Not in the generated client types, so a plain fetch is used.
export async function getOrder(
  number: string,
  email: string,
): Promise<OrderOut | null> {
  if (!number || !email) return null;
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/orders/${encodeURIComponent(number)}/lookup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as OrderOut;
  } catch {
    return null;
  }
}
