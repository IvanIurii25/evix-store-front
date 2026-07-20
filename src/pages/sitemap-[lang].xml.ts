import type { APIRoute } from 'astro';
import { getCategoryTree, listProducts } from '../api/catalog';
import { isLang, localePath, type Lang } from '../lib/i18n';

// Per-locale sitemap of published, indexable URLs (home + categories +
// products). Only the storefront-public API is walked, so unpublished entities
// never leak in. Cross-language hreflang is already emitted on-page (Layout);
// sitemap-level xhtml:link alternates are a later addition (needs a backend
// dual-slug endpoint to be efficient at scale).
export const prerender = false;

interface CatNode {
  slug: string;
  children?: CatNode[];
}

function flatten(nodes: CatNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    out.push(node.slug);
    if (node.children?.length) flatten(node.children, out);
  }
  return out;
}

async function productSlugs(lang: Lang, catSlugs: string[]): Promise<string[]> {
  const seen = new Set<string>();
  for (const slug of catSlugs) {
    let cursor: string | undefined;
    do {
      const listing = await listProducts(slug, lang, { cursor });
      for (const p of listing.data ?? []) seen.add(p.slug);
      cursor = listing.next_cursor ?? undefined;
    } while (cursor);
  }
  return [...seen];
}

export const GET: APIRoute = async ({ params, site, request }) => {
  const lang = params.lang;
  if (!isLang(lang)) return new Response('Not found', { status: 404 });

  const base = site ?? new URL(new URL(request.url).origin);
  const catSlugs = flatten((await getCategoryTree(lang)) as CatNode[]);
  const slugs = await productSlugs(lang, catSlugs);

  const paths = [
    localePath(lang),
    ...catSlugs.map((s) => localePath(lang, `c/${s}`)),
    ...slugs.map((s) => localePath(lang, `p/${s}`)),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths
      .map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`)
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
