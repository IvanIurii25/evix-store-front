import { api } from './client';
import type { components } from '../types/api';

export type AddressOut = components['schemas']['AddressOut'];
export type AddressCreate = components['schemas']['AddressCreate'];
export type OrderOut = components['schemas']['OrderOut'];

export async function listAddresses(): Promise<AddressOut[]> {
  const { data } = await api.GET('/api/v1/users/me/addresses', {
    credentials: 'include',
  });
  return data ?? [];
}

export async function createAddress(
  body: AddressCreate,
): Promise<AddressOut | null> {
  const { data } = await api.POST('/api/v1/users/me/addresses', {
    body,
    credentials: 'include',
  });
  return data ?? null;
}

export async function deleteAddress(id: number): Promise<void> {
  await api.DELETE('/api/v1/users/me/addresses/{address_id}', {
    params: { path: { address_id: id } },
    credentials: 'include',
  });
}

export async function setDefaultAddress(id: number): Promise<void> {
  await api.PATCH('/api/v1/users/me/addresses/{address_id}', {
    params: { path: { address_id: id } },
    body: { is_default: true },
    credentials: 'include',
  });
}

export async function listOrders(): Promise<OrderOut[]> {
  const { data } = await api.GET('/api/v1/orders', { credentials: 'include' });
  return data ?? [];
}
