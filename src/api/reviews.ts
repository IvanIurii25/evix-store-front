import { api } from './client';
import type { components } from '../types/api';

// Product reviews & ratings — public list/aggregate + the current user's own
// review CRUD. Every write carries the httpOnly `access` cookie
// (`credentials: 'include'`); a 401 means the visitor is a guest, which the PDP
// island turns into a login redirect (auth-intent, like restock).

type Schemas = components['schemas'];

export type RatingAggregate = Schemas['RatingAggregate'];
export type PublicReview = Schemas['PublicReviewOut'];
export type ProductReviews = Schemas['ProductReviewsOut'];
export type ReviewOut = Schemas['ReviewOut'];
export type ReviewSort = Schemas['ReviewSort'];

// Aggregate shown before the first fetch resolves (zero reviews) — also the
// SSR-seeded fallback so the section never flashes empty.
export const EMPTY_AGGREGATE: RatingAggregate = {
  average: null,
  count: 0,
  distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
};

// Approved reviews for a product (keyset paginated) + the star aggregate.
export async function getProductReviews(
  slug: string,
  opts: { lang?: string; sort?: ReviewSort; cursor?: string | null } = {},
): Promise<ProductReviews> {
  const { data, error } = await api.GET(
    '/api/v1/catalog/products/{slug}/reviews',
    {
      params: {
        path: { slug },
        query: {
          lang: opts.lang,
          sort: opts.sort,
          cursor: opts.cursor ?? undefined,
        },
      },
    },
  );
  if (error || !data) {
    return { aggregate: EMPTY_AGGREGATE, data: [], next_cursor: null };
  }
  return data;
}

export interface SubmitReviewInput {
  productId: number;
  rating: number;
  title?: string | null;
  body?: string | null;
  authorName?: string | null;
  lang: string;
}

export type SubmitResult =
  | { ok: true; review: ReviewOut }
  | { ok: false; reason: 'guest' | 'error'; message?: string };

// Create or update the current user's review (upsert by product+user). An edit
// resets the review to `pending` server-side. 401 → guest (login redirect).
export async function submitReview(
  input: SubmitReviewInput,
): Promise<SubmitResult> {
  const { data, error, response } = await api.POST('/api/v1/reviews', {
    body: {
      product_id: input.productId,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
      author_name: input.authorName ?? null,
      lang: input.lang,
    },
    credentials: 'include',
  });
  if (response.status === 401) return { ok: false, reason: 'guest' };
  if (error || !data) {
    const body = error as { error?: { message?: string } } | undefined;
    return { ok: false, reason: 'error', message: body?.error?.message };
  }
  return { ok: true, review: data };
}

export type MineResult =
  { authed: true; review: ReviewOut | null } | { authed: false };

// The current user's own review for a product (any status), or null when they
// have none. 401 → guest.
export async function getMyReview(productId: number): Promise<MineResult> {
  const { data, error, response } = await api.GET(
    '/api/v1/reviews/mine/{product_id}',
    { params: { path: { product_id: productId } }, credentials: 'include' },
  );
  if (response.status === 401) return { authed: false };
  if (response.status === 404) return { authed: true, review: null };
  if (error || !data) return { authed: true, review: null };
  return { authed: true, review: data };
}

export async function deleteMyReview(reviewId: number): Promise<void> {
  await api.DELETE('/api/v1/reviews/{review_id}', {
    params: { path: { review_id: reviewId } },
    credentials: 'include',
  });
}
