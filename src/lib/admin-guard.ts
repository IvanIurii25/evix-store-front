import type { AstroCookies } from 'astro';

import { meWithToken, type UserMe } from '../api/auth';

// Where an unauthenticated / non-staff visitor is sent. The admin panel is
// language-agnostic (staff-facing), so its login lives at a root path.
export const ADMIN_LOGIN = '/admin/login';

export interface GuardOk {
  ok: true;
  user: UserMe;
  access: string;
}
export interface GuardRedirect {
  ok: false;
  redirect: string;
}

// SSR guard for every /admin page. Reads the httpOnly `access` cookie, resolves
// the user, and requires `is_staff`. Returns either the authenticated staff user
// (+ the raw access token, for authenticated client calls) or a login redirect
// target carrying `next` so the user returns where they were headed.
export async function requireStaff(
  cookies: AstroCookies,
  currentPath: string,
): Promise<GuardOk | GuardRedirect> {
  const loginUrl = `${ADMIN_LOGIN}?next=${encodeURIComponent(currentPath)}`;
  const access = cookies.get('access')?.value;
  if (!access) return { ok: false, redirect: loginUrl };

  const user = await meWithToken(access);
  if (!user || !user.is_staff) return { ok: false, redirect: loginUrl };

  return { ok: true, user, access };
}
