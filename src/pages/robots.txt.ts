import type { APIRoute } from 'astro';
import { LANGS } from '../lib/i18n';

// robots.txt: allow indexable content, keep transactional flows out of the
// index, and point crawlers at the per-locale sitemaps.
export const prerender = false;

export const GET: APIRoute = ({ site, request }) => {
  const base = site ?? new URL(new URL(request.url).origin);
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /*/cart',
    'Disallow: /*/checkout',
    'Disallow: /*/account',
    'Disallow: /*/auth',
    ...LANGS.map((l) => `Sitemap: ${new URL(`/sitemap-${l}.xml`, base).href}`),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
