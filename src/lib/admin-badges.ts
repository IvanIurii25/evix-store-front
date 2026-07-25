import type { AstroCookies } from 'astro';

import { api } from '../api/client';

// SSR-side badge counts for the admin sidebar. These run in the Astro server
// with no browser cookie jar, so the httpOnly `access` cookie is forwarded as a
// Bearer token (the same trick `meWithToken` uses). Every call is best-effort:
// a missing token or any error yields 0 so the nav never breaks over a badge.

export async function pendingReviewsCount(
  cookies: AstroCookies,
): Promise<number> {
  const access = cookies.get('access')?.value;
  if (!access) return 0;
  const { data, error } = await api.GET('/api/v1/admin/reviews/pending-count', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (error || !data) return 0;
  return data.count;
}
