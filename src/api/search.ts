import { api } from './client';
import type { components } from '../types/api';

export type SearchResponse = components['schemas']['SearchResponse'];
export type SearchHit = components['schemas']['SearchHit'];

export async function search(
  q: string,
  lang: string,
  page = 1,
): Promise<SearchResponse> {
  const { data, error } = await api.GET('/api/v1/search', {
    params: { query: { q, lang, page } },
  });
  if (error || !data) return { data: [], total: 0, page, page_size: 0 };
  return data;
}
