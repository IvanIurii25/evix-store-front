import { api } from './client';
import type { components } from '../types/api';

export type UserMe = components['schemas']['UserMe'];

// Backend sets httpOnly access+refresh cookies on login/register (credentials:
// include so they round-trip). The Astro server reads the access cookie on SSR.

export async function login(
  ident: { email?: string; phone?: string },
  password: string,
) {
  const { data, error, response } = await api.POST('/api/v1/auth/login', {
    body: { ...ident, password },
    credentials: 'include',
  });
  if (error) {
    throw new Error(
      response.status === 401 ? 'Неверный логин или пароль' : 'Ошибка входа',
    );
  }
  return data;
}

export async function register(
  email: string,
  password: string,
  phone?: string,
) {
  const { data, error, response } = await api.POST('/api/v1/auth/register', {
    body: { email, password, phone: phone || null },
    credentials: 'include',
  });
  if (error) {
    throw new Error(
      response.status === 409
        ? 'Пользователь с таким email/телефоном уже есть'
        : 'Ошибка регистрации',
    );
  }
  return data;
}

export async function logout() {
  await api.POST('/api/v1/auth/logout', { credentials: 'include' });
}

// Server-side profile fetch: the SSR handler passes the access cookie value as a
// bearer (current_user accepts Bearer or cookie).
export async function meWithToken(access: string): Promise<UserMe | null> {
  const { data, error } = await api.GET('/api/v1/users/me', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (error || !data) return null;
  return data;
}
