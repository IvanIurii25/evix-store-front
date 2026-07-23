import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AstroCookies } from 'astro';

import { ADMIN_LOGIN, requireStaff } from './admin-guard';
import type { UserMe } from '../api/auth';

// meWithToken hits the API client; stub it so the guard's branches are pure.
const meWithToken = vi.fn<(access: string) => Promise<UserMe | null>>();
vi.mock('../api/auth', () => ({
  meWithToken: (access: string) => meWithToken(access),
}));

// Minimal AstroCookies stub — only .get('access')?.value is read.
function cookiesWith(access: string | undefined): AstroCookies {
  return {
    get: (name: string) =>
      name === 'access' && access !== undefined
        ? ({ value: access } as ReturnType<AstroCookies['get']>)
        : undefined,
  } as unknown as AstroCookies;
}

const staffUser = { is_staff: true } as UserMe;
const plainUser = { is_staff: false } as UserMe;

beforeEach(() => {
  meWithToken.mockReset();
});

describe('ADMIN_LOGIN', () => {
  it('is the language-agnostic root login path', () => {
    expect(ADMIN_LOGIN).toBe('/admin/login');
  });
});

describe('requireStaff', () => {
  it('redirects to login (with next) when no access cookie', async () => {
    const res = await requireStaff(cookiesWith(undefined), '/admin/orders?p=2');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.redirect).toBe(
        `/admin/login?next=${encodeURIComponent('/admin/orders?p=2')}`,
      );
    }
    expect(meWithToken).not.toHaveBeenCalled();
  });

  it('redirects when the token resolves to no user', async () => {
    meWithToken.mockResolvedValue(null);
    const res = await requireStaff(cookiesWith('tok'), '/admin');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.redirect).toBe('/admin/login?next=%2Fadmin');
  });

  it('redirects when the user is authenticated but not staff', async () => {
    meWithToken.mockResolvedValue(plainUser);
    const res = await requireStaff(cookiesWith('tok'), '/admin');
    expect(res.ok).toBe(false);
  });

  it('returns the staff user + access token on success', async () => {
    meWithToken.mockResolvedValue(staffUser);
    const res = await requireStaff(cookiesWith('tok'), '/admin/orders');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user).toBe(staffUser);
      expect(res.access).toBe('tok');
    }
    expect(meWithToken).toHaveBeenCalledWith('tok');
  });
});
