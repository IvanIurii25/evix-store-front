import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import ReviewsQueue from './ReviewsQueue.vue';
import {
  listAdminReviews,
  moderateReview,
  deleteAdminReview,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({
  listAdminReviews: vi.fn(),
  moderateReview: vi.fn(),
  deleteAdminReview: vi.fn(),
}));

const mockList = vi.mocked(listAdminReviews);
const mockModerate = vi.mocked(moderateReview);
const mockDelete = vi.mocked(deleteAdminReview);

function row(id: number, status = 'pending') {
  return {
    id,
    product_id: 100 + id,
    user_id: 1,
    rating: 5,
    title: `Title ${id}`,
    body: `Body ${id}`,
    author_name: 'Ana',
    status,
    is_verified: true,
    lang: 'ru',
    created_at: '2026-07-01T10:00:00Z',
    moderated_at: null,
  };
}

beforeEach(() => {
  mockList.mockReset();
  mockModerate.mockReset();
  mockDelete.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReviewsQueue', () => {
  it('loads the pending queue by default', async () => {
    mockList.mockResolvedValue({ data: [row(1), row(2)], next_cursor: null });
    const w = mount(ReviewsQueue);
    await flushPromises();
    expect(mockList).toHaveBeenCalledWith({ status: 'pending', cursor: null });
    expect(w.text()).toContain('Title 1');
    expect(w.text()).toContain('✓ куплено'); // verified badge
  });

  it('re-queries when the status filter changes', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    const w = mount(ReviewsQueue);
    await flushPromises();
    mockList.mockResolvedValue({ data: [], next_cursor: null });
    await w
      .findAll('button')
      .find((b) => b.text() === 'Все')!
      .trigger('click');
    await flushPromises();
    // "all" maps to a null status filter.
    expect(mockList).toHaveBeenLastCalledWith({ status: null, cursor: null });
  });

  it('approves a row and drops it from the pending view', async () => {
    mockList.mockResolvedValue({ data: [row(1), row(2)], next_cursor: null });
    mockModerate.mockResolvedValue({ ...row(1, 'approved') });
    const w = mount(ReviewsQueue);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Одобрить')!
      .trigger('click');
    await flushPromises();
    expect(mockModerate).toHaveBeenCalledWith(1, 'approved');
    // Row 1 approved → no longer matches the pending filter → removed.
    expect(w.text()).not.toContain('Title 1');
    expect(w.text()).toContain('Title 2');
  });

  it('rejects a row via the reject action', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    mockModerate.mockResolvedValue({ ...row(1, 'rejected') });
    const w = mount(ReviewsQueue);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Отклонить')!
      .trigger('click');
    await flushPromises();
    expect(mockModerate).toHaveBeenCalledWith(1, 'rejected');
  });

  it('deletes a row after confirmation', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    mockDelete.mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const w = mount(ReviewsQueue);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Удалить')!
      .trigger('click');
    await flushPromises();
    expect(mockDelete).toHaveBeenCalledWith(1);
    expect(w.text()).not.toContain('Title 1');
  });

  it('paginates via "show more"', async () => {
    mockList.mockResolvedValueOnce({ data: [row(1)], next_cursor: 'c2' });
    const w = mount(ReviewsQueue);
    await flushPromises();
    mockList.mockResolvedValueOnce({ data: [row(2)], next_cursor: null });
    await w
      .findAll('button')
      .find((b) => b.text() === 'Показать ещё')!
      .trigger('click');
    await flushPromises();
    expect(mockList).toHaveBeenLastCalledWith({
      status: 'pending',
      cursor: 'c2',
    });
    expect(w.text()).toContain('Title 1');
    expect(w.text()).toContain('Title 2');
  });

  it('surfaces a load error', async () => {
    mockList.mockRejectedValue(new Error('down'));
    const w = mount(ReviewsQueue);
    await flushPromises();
    expect(w.text()).toContain('down');
  });

  it('surfaces a moderation error (non-Error fallback)', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    mockModerate.mockRejectedValue('boom');
    const w = mount(ReviewsQueue);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Одобрить')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось обновить');
  });

  it('does not delete when the confirm is dismissed', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const w = mount(ReviewsQueue);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Удалить')!
      .trigger('click');
    await flushPromises();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(w.text()).toContain('Title 1');
  });

  it('surfaces a delete error (non-Error fallback)', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    mockDelete.mockRejectedValue('boom');
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const w = mount(ReviewsQueue);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Удалить')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось удалить');
  });

  it('keeps a moderated row under the "all" filter', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    const w = mount(ReviewsQueue);
    await flushPromises();
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    await w
      .findAll('button')
      .find((b) => b.text() === 'Все')!
      .trigger('click');
    await flushPromises();
    mockModerate.mockResolvedValue({ ...row(1, 'approved') });
    await w
      .findAll('button')
      .find((b) => b.text() === 'Одобрить')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Title 1'); // not dropped under "all"
  });

  it('ignores clicking the already-active filter', async () => {
    mockList.mockResolvedValue({ data: [row(1)], next_cursor: null });
    const w = mount(ReviewsQueue);
    await flushPromises();
    const calls = mockList.mock.calls.length;
    await w
      .findAll('button')
      .find((b) => b.text() === 'На модерации')!
      .trigger('click');
    await flushPromises();
    expect(mockList.mock.calls.length).toBe(calls); // same filter → no re-query
  });

  it('renders a dash for an invalid moderation date', async () => {
    mockList.mockResolvedValue({
      data: [{ ...row(1), created_at: 'not-a-date' }],
      next_cursor: null,
    });
    const w = mount(ReviewsQueue);
    await flushPromises();
    expect(w.text()).toContain('—');
  });

  it('renders diverse row states (statuses, unverified, low rating, empty text)', async () => {
    mockList.mockResolvedValue({
      data: [
        {
          ...row(1, 'approved'),
          is_verified: false,
          rating: 2,
          title: '',
          body: '',
        },
        { ...row(2, 'rejected') },
      ],
      next_cursor: null,
    });
    const w = mount(ReviewsQueue);
    await flushPromises();
    expect(w.text()).toContain('одобрен'); // approved status label
    expect(w.text()).toContain('отклонён'); // rejected status label
    // approved row hides "Одобрить"; rejected row hides "Отклонить"
    expect(w.text()).toContain('Одобрить'); // shown for the rejected row
    expect(w.text()).toContain('Отклонить'); // shown for the approved row
  });
});
