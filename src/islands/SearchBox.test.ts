import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import SearchBox from './SearchBox.vue';
import { search, type SearchHit } from '../api/search';

vi.mock('../api/search', () => ({ search: vi.fn() }));

const mockSearch = vi.mocked(search);

const hit = (over: Partial<SearchHit['card']> = {}): SearchHit =>
  ({
    card: {
      product_id: 1,
      name: 'Регистратор',
      slug: 'reg',
      price: '1990',
      in_stock: true,
      main_image_url: 'https://media.evix.md/p/reg.jpg',
      old_price: null,
      badge: null,
      ...over,
    },
  }) as SearchHit;

const response = (hits: SearchHit[]) => ({
  data: hits,
  total: hits.length,
  page: 1,
  page_size: hits.length,
});

let originalLocation: Location;

beforeEach(() => {
  mockSearch.mockReset();
  vi.useFakeTimers();
  originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...originalLocation, href: '' },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

const props = { lang: 'ru' as const };

describe('SearchBox', () => {
  it('does not query for inputs shorter than 2 chars', async () => {
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('a');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(mockSearch).not.toHaveBeenCalled();
    expect(w.find('div.absolute').exists()).toBe(false);
  });

  it('debounces then queries and renders up to 6 results', async () => {
    mockSearch.mockResolvedValue(
      response(
        Array.from({ length: 8 }, (_, i) =>
          hit({ product_id: i, slug: `s${i}` }),
        ),
      ),
    );
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    // Not called until the debounce elapses.
    expect(mockSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(mockSearch).toHaveBeenCalledWith('reg', 'ru', 1);
    // capped at 6
    expect(w.findAll('a')).toHaveLength(6);
  });

  it('shows an error in the dropdown when the search fails', async () => {
    mockSearch.mockRejectedValue(new Error('network'));
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();

    expect(w.text()).toContain('Ошибка поиска.');
    expect(w.findAll('a')).toHaveLength(0);
  });

  it('collapses the debounce when typing quickly (only one query)', async () => {
    mockSearch.mockResolvedValue(response([hit()]));
    const w = mount(SearchBox, { props });
    const input = w.find('input');
    await input.setValue('re');
    await input.trigger('input');
    vi.advanceTimersByTime(100);
    await input.setValue('reg');
    await input.trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('reg', 'ru', 1);
  });

  it('renders a result link, image srcset, name and price', async () => {
    mockSearch.mockResolvedValue(response([hit()]));
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    const link = w.find('a');
    expect(link.attributes('href')).toBe('/ru/p/reg');
    expect(link.find('source').attributes('srcset')).toContain('.webp');
    expect(link.text()).toContain('Регистратор');
    expect(link.text()).toContain('990');
    // "all results" submit button in the dropdown
    expect(w.find('button[type="submit"]').exists()).toBe(true);
  });

  it('omits the image element for hits without a main image', async () => {
    mockSearch.mockResolvedValue(response([hit({ main_image_url: null })]));
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(w.find('a picture').exists()).toBe(false);
  });

  it('shows no dropdown when the API returns no data', async () => {
    mockSearch.mockResolvedValue({ data: [], total: 0, page: 1, page_size: 0 });
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(w.find('div.absolute').exists()).toBe(false);
  });

  it('clears results when the query is shortened below 2 chars', async () => {
    mockSearch.mockResolvedValue(response([hit()]));
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(w.findAll('a')).toHaveLength(1);

    await w.find('input').setValue('r');
    await w.find('input').trigger('input');
    await flushPromises();
    expect(w.find('div.absolute').exists()).toBe(false);
  });

  it('submits to the search page with the encoded query', async () => {
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('a b');
    await w.find('form').trigger('submit');
    expect(window.location.href).toBe('/ru/search?q=a%20b');
  });

  it('does not navigate on submit with an empty query', async () => {
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('   ');
    await w.find('form').trigger('submit');
    expect(window.location.href).toBe('');
  });

  it('reopens the dropdown on focus when results exist', async () => {
    mockSearch.mockResolvedValue(response([hit()]));
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    // simulate an outside close then refocus
    document.dispatchEvent(new MouseEvent('click'));
    await flushPromises();
    expect(w.find('div.absolute').exists()).toBe(false);
    await w.find('input').trigger('focus');
    expect(w.find('div.absolute').exists()).toBe(true);
  });

  it('closes the dropdown on an outside document click and cleans up on unmount', async () => {
    mockSearch.mockResolvedValue(response([hit()]));
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const w = mount(SearchBox, { props });
    await w.find('input').setValue('reg');
    await w.find('input').trigger('input');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(w.find('div.absolute').exists()).toBe(true);

    document.dispatchEvent(new MouseEvent('click'));
    await flushPromises();
    expect(w.find('div.absolute').exists()).toBe(false);

    // clicking inside the form keeps it open
    await w.find('input').trigger('focus');
    (w.element as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    w.unmount();
    expect(removeSpy).toHaveBeenCalled();
  });
});
