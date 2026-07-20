import { api } from './client';

// Thin, typed helpers over the catalog endpoints (see src/types/api.d.ts).

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

export async function listProducts(slug: string, lang: string) {
  const { data, error } = await api.GET(
    '/api/v1/catalog/categories/{slug}/products',
    { params: { path: { slug }, query: { lang } } },
  );
  if (error || !data) throw new Error(`listProducts(${slug}) failed`);
  return data;
}

export async function getProduct(slug: string, lang: string) {
  const { data, error } = await api.GET('/api/v1/catalog/products/{slug}', {
    params: { path: { slug }, query: { lang } },
  });
  if (error || !data) return null; // 404 -> null
  return data;
}
