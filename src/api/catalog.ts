import { api } from './client';
import type { components } from '../types/api';

// Thin, typed helpers over the catalog endpoints (see src/types/api.d.ts).

export type ProductCard = components['schemas']['ProductCardOut'];
export type ProductListing = components['schemas']['ProductListing'];
export type FacetsResponse = components['schemas']['FacetsResponse'];
export type ProductSort = components['schemas']['ProductSort'];

export interface ListOpts {
  sort?: ProductSort;
  cursor?: string;
  priceMin?: number;
  priceMax?: number;
  valueIds?: number[];
}

export async function getCategoryTree(lang: string) {
  const { data } = await api.GET('/api/v1/catalog/categories', {
    params: { query: { lang } },
  });
  return data ?? [];
}

export async function getCategory(slug: string, lang: string) {
  const { data, error } = await api.GET('/api/v1/catalog/categories/{slug}', {
    params: { path: { slug }, query: { lang } },
  });
  if (error || !data) throw new Error(`getCategory(${slug}) failed`);
  return data;
}

export async function listProducts(
  slug: string,
  lang: string,
  opts: ListOpts = {},
): Promise<ProductListing> {
  const { data, error } = await api.GET(
    '/api/v1/catalog/categories/{slug}/products',
    {
      params: {
        path: { slug },
        query: {
          lang,
          sort: opts.sort,
          cursor: opts.cursor,
          price_min: opts.priceMin,
          price_max: opts.priceMax,
          value_ids: opts.valueIds,
        },
      },
    },
  );
  if (error || !data) throw new Error(`listProducts(${slug}) failed`);
  return data;
}

export interface ListAllOpts {
  sort?: ProductSort;
  onSale?: boolean;
  featured?: boolean;
  cursor?: string;
  priceMin?: number;
  priceMax?: number;
}

// Store-wide listing (not scoped to a category) — powers the homepage rails
// ("newest", "on sale"). Same {data, next_cursor} keyset contract as listProducts.
export async function listAllProducts(
  lang: string,
  opts: ListAllOpts = {},
): Promise<ProductListing> {
  const { data, error } = await api.GET('/api/v1/catalog/products', {
    params: {
      query: {
        lang,
        sort: opts.sort,
        on_sale: opts.onSale,
        featured: opts.featured,
        cursor: opts.cursor,
        price_min: opts.priceMin,
        price_max: opts.priceMax,
      },
    },
  });
  if (error || !data) throw new Error('listAllProducts failed');
  return data;
}

export async function getFacets(
  slug: string,
  lang: string,
): Promise<FacetsResponse> {
  const { data, error } = await api.GET(
    '/api/v1/catalog/categories/{slug}/facets',
    { params: { path: { slug }, query: { lang } } },
  );
  if (error || !data)
    return { attributes: [], price_min: null, price_max: null };
  return data;
}

export async function getProduct(slug: string, lang: string) {
  const { data, error } = await api.GET('/api/v1/catalog/products/{slug}', {
    params: { path: { slug }, query: { lang } },
  });
  if (error || !data) return null; // 404 -> null
  return data;
}

// Cross-sell: other in-stock products from the same category (best-effort — []
// on any failure so the product page never breaks over recommendations).
export async function getRelatedProducts(
  slug: string,
  lang: string,
  limit = 8,
): Promise<ProductCard[]> {
  const { data, error } = await api.GET(
    '/api/v1/catalog/products/{slug}/related',
    { params: { path: { slug }, query: { lang, limit } } },
  );
  if (error || !data) return [];
  return data;
}

export type SitemapData = components['schemas']['SitemapData'];

// Flat feed of all published categories + products with per-language slugs +
// updated_at — one request powers the per-locale sitemaps with hreflang.
export async function getSitemap(): Promise<SitemapData> {
  const { data, error } = await api.GET('/api/v1/catalog/sitemap');
  if (error || !data) throw new Error('getSitemap failed');
  return data;
}
