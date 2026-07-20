import { api } from './client';
import type { components } from '../types/api';

export type QuoteOut = components['schemas']['QuoteOut'];
export type OrderOut = components['schemas']['OrderOut'];

export async function quote(
  deliveryType: string,
  addressId?: number,
): Promise<QuoteOut | null> {
  const { data, error } = await api.POST('/api/v1/checkout/quote', {
    body: {
      delivery_type: deliveryType,
      delivery_address_id: addressId ?? null,
    },
    credentials: 'include',
  });
  if (error || !data) return null;
  return data;
}

export async function checkout(body: {
  email: string;
  phone: string;
  delivery_type: string;
  delivery_address_id?: number | null;
}): Promise<OrderOut> {
  const { data, error, response } = await api.POST('/api/v1/checkout', {
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

export async function getOrder(
  number: string,
  email: string,
): Promise<OrderOut | null> {
  const { data, error } = await api.GET('/api/v1/orders/{number}', {
    params: { path: { number }, query: { email } },
  });
  if (error || !data) return null;
  return data;
}
