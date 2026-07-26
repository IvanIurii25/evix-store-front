import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import ProductReviews from './ProductReviews.vue';
import {
  getProductReviews,
  submitReview,
  getMyReview,
  deleteMyReview,
} from '../api/reviews';

vi.mock('../api/reviews', async () => {
  const actual =
    await vi.importActual<typeof import('../api/reviews')>('../api/reviews');
  return {
    ...actual,
    getProductReviews: vi.fn(),
    submitReview: vi.fn(),
    getMyReview: vi.fn(),
    deleteMyReview: vi.fn(),
  };
});

const mockList = vi.mocked(getProductReviews);
const mockSubmit = vi.mocked(submitReview);
const mockMine = vi.mocked(getMyReview);
const mockDelete = vi.mocked(deleteMyReview);

const replaceState = vi.fn();
let originalLocation: Location;

function setUrl(href: string) {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      href,
      search: url.search,
      pathname: url.pathname,
      origin: url.origin,
    },
  });
}

const AGG = {
  average: 4.5,
  count: 2,
  distribution: { '5': 1, '4': 1, '3': 0, '2': 0, '1': 0 },
};

function reviewsPage(next: string | null = null) {
  return {
    aggregate: AGG,
    data: [
      {
        id: 1,
        rating: 5,
        title: 'Super',
        body: 'Great product',
        author_name: 'Ana',
        is_verified: true,
        created_at: '2026-07-01T10:00:00Z',
      },
      {
        id: 2,
        rating: 4,
        title: null,
        body: null,
        author_name: null,
        is_verified: false,
        created_at: '2026-06-01T10:00:00Z',
      },
    ],
    next_cursor: next,
  };
}

const props = {
  productId: 42,
  slug: 'cam',
  lang: 'ru' as const,
  productPath: '/ru/p/cam',
};

// Logged-in variant: only these viewers fetch /reviews/mine.
const authedProps = { ...props, isLoggedIn: true };

beforeEach(() => {
  mockList.mockReset();
  mockSubmit.mockReset();
  mockMine.mockReset();
  mockDelete.mockReset();
  replaceState.mockReset();
  originalLocation = window.location;
  setUrl('https://shop.evix.md/ru/p/cam');
  vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState);
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ProductReviews', () => {
  it('renders the aggregate, distribution and approved list', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: false });
    const w = mount(ProductReviews, { props });
    await flushPromises();
    expect(w.text()).toContain('4.5');
    expect(w.text()).toContain('Super');
    expect(w.text()).toContain('Great product');
    // Verified badge on the first review, anonymous fallback on the second.
    expect(w.text()).toContain('✓ Проверенная покупка');
    expect(w.text()).toContain('Покупатель');
  });

  it('re-fetches with the chosen sort order', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: false });
    const w = mount(ProductReviews, { props });
    await flushPromises();
    const highest = w
      .findAll('button')
      .find((b) => b.text() === 'Высокая оценка')!;
    await highest.trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith('cam', {
      lang: 'ru',
      sort: 'highest',
      cursor: undefined,
    });
  });

  it('routes a guest who clicks "leave a review" to login with intent', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: false });
    const w = mount(ProductReviews, { props });
    await flushPromises();
    const cta = w.findAll('button').find((b) => b.text() === 'Оставить отзыв')!;
    await cta.trigger('click');
    expect(window.location.href).toContain('/ru/auth?next=');
    expect(decodeURIComponent(window.location.href)).toContain(
      '/ru/p/cam?review=1',
    );
  });

  it('never calls getMyReview for a guest (no isLoggedIn) → no 401 in console', async () => {
    mockList.mockResolvedValue(reviewsPage());
    const w = mount(ProductReviews, { props }); // no isLoggedIn → guest
    await flushPromises();
    expect(mockMine).not.toHaveBeenCalled();
    // Guest still sees the CTA (routes to login on click).
    expect(w.findAll('button').some((b) => b.text() === 'Оставить отзыв')).toBe(
      true,
    );
  });

  it('submits a review through the star picker and shows the moderation notice', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: true, review: null });
    mockSubmit.mockResolvedValue({
      ok: true,
      review: {
        id: 9,
        product_id: 42,
        rating: 5,
        title: null,
        body: null,
        author_name: null,
        status: 'pending',
        is_verified: false,
        lang: 'ru',
        created_at: '',
        updated_at: '',
      },
    });
    const w = mount(ProductReviews, { props: authedProps });
    await flushPromises();
    // Open the form (authed, no existing review).
    await w
      .findAll('button')
      .find((b) => b.text() === 'Оставить отзыв')!
      .trigger('click');
    // Pick 5 stars via the picker (aria-label carries the star value).
    const stars = w.findAll('button[aria-label]');
    await stars[4].trigger('click');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 42, rating: 5, lang: 'ru' }),
    );
    expect(w.text()).toContain('Отзыв отправлен на модерацию');
  });

  it('blocks submit until a rating is chosen', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: true, review: null });
    const w = mount(ProductReviews, { props: authedProps });
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Оставить отзыв')!
      .trigger('click');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(w.text()).toContain('Выберите оценку');
  });

  it('shows the existing review with its status and allows deletion', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({
      authed: true,
      review: {
        id: 3,
        product_id: 42,
        rating: 3,
        title: 'Meh',
        body: 'ok',
        author_name: 'Ivan',
        status: 'pending',
        is_verified: false,
        lang: 'ru',
        created_at: '',
        updated_at: '',
      },
    });
    mockDelete.mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const w = mount(ProductReviews, { props: authedProps });
    await flushPromises();
    expect(w.text()).toContain('Ваш отзыв');
    expect(w.text()).toContain('на проверке');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Удалить')!
      .trigger('click');
    await flushPromises();
    expect(mockDelete).toHaveBeenCalledWith(3);
  });

  it('auto-opens the form after a login redirect (?review=1) and strips the flag', async () => {
    setUrl('https://shop.evix.md/ru/p/cam?review=1');
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: true, review: null });
    const w = mount(ProductReviews, { props: authedProps });
    await flushPromises();
    expect(replaceState).toHaveBeenCalled();
    expect(w.find('form').exists()).toBe(true); // form auto-opened
  });

  it('loads the next page when "show more" is clicked', async () => {
    mockList.mockResolvedValueOnce(reviewsPage('cursor-2'));
    mockMine.mockResolvedValue({ authed: false });
    const w = mount(ProductReviews, { props });
    await flushPromises();
    mockList.mockResolvedValueOnce(reviewsPage(null));
    await w
      .findAll('button')
      .find((b) => b.text() === 'Показать ещё')!
      .trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith('cam', {
      lang: 'ru',
      sort: 'newest',
      cursor: 'cursor-2',
    });
  });

  it('renders RO copy for the ro locale', async () => {
    mockList.mockResolvedValue(reviewsPage());
    mockMine.mockResolvedValue({ authed: false });
    const w = mount(ProductReviews, { props: { ...props, lang: 'ro' } });
    await flushPromises();
    expect(w.text()).toContain('Lasă o recenzie');
    expect(w.text()).toContain('✓ Achiziție verificată');
  });
});
