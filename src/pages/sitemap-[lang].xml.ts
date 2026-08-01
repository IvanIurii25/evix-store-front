import type { APIRoute } from 'astro';
import { getSitemap, type SitemapData } from '../api/catalog';
import { loadFooterPages } from '../api/site';
import {
  isLang,
  localePath,
  LANGS,
  DEFAULT_LOCALE,
  type Lang,
} from '../lib/i18n';

// Per-locale sitemap of published, indexable URLs with hreflang alternates.
// Data comes from one flat backend feed (dual-slug + updated_at), so no tree
// walk or per-entity round-trips.
export const prerender = false;

type Entry = NonNullable<SitemapData['categories']>[number];

const abs = (base: URL, path: string): string => new URL(path, base).href;

function slugFor(entry: Entry, lang: Lang): string | undefined {
  return (entry.slugs ?? []).find((s) => s.lang === lang)?.slug;
}

// <xhtml:link> alternates for every locale the entity has + x-default.
function alternates(base: URL, kind: 'c' | 'p', entry: Entry): string[] {
  const links = (entry.slugs ?? [])
    .filter((s) => isLang(s.lang))
    .map(
      (s) =>
        `    <xhtml:link rel="alternate" hreflang="${s.lang}" href="${abs(base, localePath(s.lang as Lang, `${kind}/${s.slug}`))}"/>`,
    );
  const def = slugFor(entry, DEFAULT_LOCALE);
  if (def) {
    links.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(base, localePath(DEFAULT_LOCALE, `${kind}/${def}`))}"/>`,
    );
  }
  return links;
}

// A <url> block for one entity in the requested locale, or null if it has no
// slug there (not indexable in that language).
function urlBlock(
  base: URL,
  lang: Lang,
  kind: 'c' | 'p',
  entry: Entry,
): string | null {
  const slug = slugFor(entry, lang);
  if (!slug) return null;
  const loc = abs(base, localePath(lang, `${kind}/${slug}`));
  const lastmod = entry.updated_at
    ? `\n    <lastmod>${entry.updated_at.slice(0, 10)}</lastmod>`
    : '';
  const links = alternates(base, kind, entry).join('\n');
  return `  <url>\n    <loc>${loc}</loc>${lastmod}\n${links}\n  </url>`;
}

// A <url> block for a content page (info/legal). Its slug is shared across
// locales and both translations exist, so it alternates to every locale + x-default.
function infoBlock(base: URL, lang: Lang, slug: string): string {
  const loc = abs(base, localePath(lang, `info/${slug}`));
  const links = [
    ...LANGS.map(
      (l) =>
        `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(base, localePath(l, `info/${slug}`))}"/>`,
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(base, localePath(DEFAULT_LOCALE, `info/${slug}`))}"/>`,
  ].join('\n');
  return `  <url>\n    <loc>${loc}</loc>\n${links}\n  </url>`;
}

export const GET: APIRoute = async ({ params, site, request }) => {
  const lang = params.lang;
  if (!isLang(lang)) return new Response('Not found', { status: 404 });

  const base = site ?? new URL(new URL(request.url).origin);
  const data = await getSitemap();
  const pages = await loadFooterPages(lang);

  // Static pages present in every locale (home, catalog hub): each alternates
  // to the same path under every locale + x-default.
  const staticBlock = (path: string): string => {
    const links = [
      ...LANGS.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(base, localePath(l, path))}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(base, localePath(DEFAULT_LOCALE, path))}"/>`,
    ].join('\n');
    return `  <url>\n    <loc>${abs(base, localePath(lang, path))}</loc>\n${links}\n  </url>`;
  };
  const blocks: string[] = [
    staticBlock(''),
    staticBlock('c'),
    ...(data.categories ?? []).map((c) => urlBlock(base, lang, 'c', c)),
    ...(data.products ?? []).map((p) => urlBlock(base, lang, 'p', p)),
    ...pages.map((p) => infoBlock(base, lang, p.slug)),
  ].filter((b): b is string => b !== null);

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    blocks.join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
