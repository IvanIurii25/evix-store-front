import { randomUUID } from 'node:crypto';

import type { MiddlewareHandler } from 'astro';

import { API_BASE } from './config/env';

// First-party analytics: on each storefront HTML navigation we assign/read a
// rotating `sid` cookie and fire a non-blocking pageview to the backend track
// endpoint (§6.3). No third-party scripts, no client JS — the count happens
// server-side. Admin, API and asset requests are never tracked.

const SID_COOKIE = 'sid';
// ~13 months, so a returning visitor keeps the same session id for trend
// continuity (still first-party, not identity-linked).
const SID_MAX_AGE = 60 * 60 * 24 * 400;

// Skip non-page requests: the admin panel, API calls, Astro assets, and any
// path that looks like a file (has an extension).
function isTrackablePath(pathname: string): boolean {
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_') ||
    pathname.startsWith('/favicon')
  ) {
    return false;
  }
  const last = pathname.split('/').pop() ?? '';
  return !last.includes('.');
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, cookies, url, clientAddress } = context;

  if (request.method !== 'GET' || !isTrackablePath(url.pathname)) {
    return next();
  }

  let sid = cookies.get(SID_COOKIE)?.value;
  if (!sid) {
    sid = randomUUID();
    cookies.set(SID_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SID_MAX_AGE,
    });
  }

  // Fire-and-forget: never block the page render on analytics, never throw.
  const access = cookies.get('access')?.value;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Forward the visitor's IP + UA so the backend rate-limits per visitor
    // (not per Astro server) and derives the device class.
    'X-Forwarded-For': clientAddress ?? '',
    'User-Agent': request.headers.get('User-Agent') ?? '',
  };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  void fetch(`${API_BASE}/api/v1/track/pageview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      path: url.pathname,
      session_id: sid,
      referrer: request.headers.get('Referer') ?? null,
    }),
  }).catch(() => {
    // Analytics must never affect the storefront — swallow every failure.
  });

  return next();
};
