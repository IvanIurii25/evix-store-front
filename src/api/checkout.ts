import { api } from './client';
import { API_BASE } from '../config/env';
import type { components } from '../types/api';

export type QuoteOut = components['schemas']['QuoteOut'];
export type OrderOut = components['schemas']['OrderOut'];
export type DeliveryAddressIn = components['schemas']['DeliveryAddressIn'];

// Result of a promo-aware quote. `error` carries the backend error code
// (promo_invalid | promo_expired | promo_min_order | promo_usage_limit, or a
// generic code) so the UI can show a targeted message; `data` is null when the
// quote itself could not be computed (e.g. empty cart, missing address).
export interface QuoteResult {
  data: QuoteOut | null;
  error: string | null;
}

// Shape of the storefront error envelope: { error: { code, message } }.
type ErrorBody = { error?: { code?: string; message?: string } };

// Full-result quote: returns the computed totals AND any error code. Used by the
// checkout island so it can surface a promo-code failure without discarding the
// quote flow. `promoCode` is only sent when non-empty.
export async function quoteResult(
  deliveryType: string,
  deliveryAddress?: DeliveryAddressIn | null,
  lang?: string,
  deliveryAddressId?: number | null,
  promoCode?: string | null,
): Promise<QuoteResult> {
  const code = promoCode?.trim() ? promoCode.trim() : null;
  const { data, error } = await api.POST('/api/v1/checkout/quote', {
    params: { query: { lang } },
    body: {
      delivery_type: deliveryType,
      delivery_address: deliveryAddress ?? null,
      delivery_address_id: deliveryAddressId ?? null,
      // Only sent when a coupon is entered, so promo-free quotes keep their
      // exact prior request body.
      ...(code ? { promo_code: code } : {}),
    },
    credentials: 'include',
  });
  if (error || !data) {
    const code = (error as ErrorBody | undefined)?.error?.code ?? null;
    return { data: null, error: code };
  }
  return { data, error: null };
}

export async function quote(
  deliveryType: string,
  deliveryAddress?: DeliveryAddressIn | null,
  lang?: string,
  deliveryAddressId?: number | null,
  promoCode?: string | null,
): Promise<QuoteOut | null> {
  const { data } = await quoteResult(
    deliveryType,
    deliveryAddress,
    lang,
    deliveryAddressId,
    promoCode,
  );
  return data;
}

export async function checkout(
  body: {
    email: string;
    phone: string;
    delivery_type: string;
    delivery_address?: DeliveryAddressIn | null;
    delivery_address_id?: number | null;
    promo_code?: string | null;
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

// Result of a one-click ("quick buy") order. `data` is the created order on
// success; `error` carries the backend error code (product_not_found |
// out_of_stock | validation, or a generic code) so the island can show a
// targeted, localized message without discarding the flow.
export interface QuickBuyResult {
  data: OrderOut | null;
  error: string | null;
}

// One-click COD buy (feature A2): phone-only, no cart, no full checkout. Sends
// the current product + phone (+ optional name) to POST /checkout/quick and
// unwraps the storefront `{error:{code}}` envelope. `name` is only sent when
// non-empty so a name-free order keeps a minimal body.
export async function quickBuy(
  body: { product_id: number; phone: string; name?: string | null },
  lang?: string,
): Promise<QuickBuyResult> {
  const name = body.name?.trim() ? body.name.trim() : null;
  const { data, error, response } = await api.POST('/api/v1/checkout/quick', {
    params: { query: { lang } },
    body: {
      product_id: body.product_id,
      phone: body.phone,
      // Always 1 — the one-click flow buys a single unit. Sent explicitly
      // because the generated request type marks `qty` as required.
      qty: 1,
      ...(name ? { name } : {}),
    },
  });
  if (error || !data) {
    // Prefer the envelope code; fall back to a status-derived code so the UI
    // always has something to localize (422 has no envelope code here).
    const code =
      (error as ErrorBody | undefined)?.error?.code ??
      (response.status === 422 ? 'validation' : 'generic');
    return { data: null, error: code };
  }
  return { data, error: null };
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
