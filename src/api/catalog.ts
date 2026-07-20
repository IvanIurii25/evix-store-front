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
