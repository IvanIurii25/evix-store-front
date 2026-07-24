import { api } from './client';
import { API_BASE } from '../config/env';
import type { components } from '../types/api';

export type AddressOut = components['schemas']['AddressOut'];
export type AddressCreate = components['schemas']['AddressCreate'];
export type OrderOut = components['schemas']['OrderOut'];

// Right to erasure (LP195/2024 Art.17). Not in the generated client types yet,
// so a plain fetch is used; the httpOnly access cookie authorizes the request.
export async function deleteAccount(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listAddresses(): Promise<AddressOut[]> {
  const { data } = await api.GET('/api/v1/users/me/addresses', {
    credentials: 'include',
  });
  return data ?? [];
}

// Server-side address fetch: the SSR handler passes the access cookie value as a
// bearer (mirrors auth.meWithToken).
export async function listAddressesWithToken(
  access: string,
): Promise<AddressOut[]> {
  const { data } = await api.GET('/api/v1/users/me/addresses', {
    headers: { Authorization: `Bearer ${access}` },
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
