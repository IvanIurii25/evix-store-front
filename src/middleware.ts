import { randomUUID } from 'node:crypto';

import { middleware as i18nMiddleware } from 'astro:i18n';
import { sequence } from 'astro:middleware';
import type { MiddlewareHandler } from 'astro';

import { API_BASE } from './config/env';
import { CONSENT_COOKIE, analyticsGranted } from './lib/consent';

// i18n routing runs in `manual` mode (astro.config) so we can exempt the admin
// panel. Astro's built-in i18n middleware, under prefixDefaultLocale, treats a
// non-localized first segment ("admin") as an invalid locale and 404s it — so
// /admin/* is passed straight through, while the storefront keeps the same
// prefix/redirect behaviour as before.
const i18n = i18nMiddleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: true,
  fallbackType: 'redirect',
});

const i18nRouting: MiddlewareHandler = (context, next) => {
  if (context.url.pathname.startsWith('/admin')) return next();
  return i18n(context, next);
};

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

// The container's own healthcheck fetches /ro every 15s from inside the
// container, so its client address is loopback; real visitors always arrive
// via the separate cloudflared container (a non-loopback bridge IP). Skipping
// loopback keeps the healthcheck from minting a fresh cookieless session (and a
// phantom "unique") on every probe, without writing any bot rows.
function isLoopback(address: string | undefined): boolean {
  return (
    address === '::1' ||
    address === '127.0.0.1' ||
    address === '::ffff:127.0.0.1'
  );
}

const analytics: MiddlewareHandler = async (context, next) => {
  const { request, cookies, url, clientAddress } = context;

  if (
    request.method !== 'GET' ||
    !isTrackablePath(url.pathname) ||
    isLoopback(clientAddress)
  ) {
    return next();
  }

  // LP195/2024 (= GDPR): the analytics `sid` cookie and the pageview are set /
  // fired only after the visitor grants analytics consent via the banner. No
  // consent → no cookie, no tracking.
  if (!analyticsGranted(cookies.get(CONSENT_COOKIE)?.value)) {
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

// i18n routing first (exempting /admin), then first-party analytics.
export const onRequest = sequence(i18nRouting, analytics);
