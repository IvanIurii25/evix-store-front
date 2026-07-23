import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import RecentlyViewed from './RecentlyViewed.vue';
import type { Lang } from '../lib/i18n';

const KEY = 'evix_recently_viewed';

const current = {
  slug: 'current',
  name: 'Current',
  image: 'https://media.evix.md/p/current.jpg',
  price: '100',
};
const other = {
  slug: 'other',
  name: 'Other',
  image: 'https://media.evix.md/p/other.jpg',
  price: '200',
};
const noImg = { slug: 'noimg', name: 'NoImg', image: null, price: '300' };

// onMounted writes `items`, which re-renders on the next tick — await it before
// asserting on the DOM.
async function make(lang: Lang = 'ru') {
  const w = mount(RecentlyViewed, { props: { current, lang } });
  await nextTick();
  return w;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('RecentlyViewed', () => {
  it('renders nothing when history holds only the current product', async () => {
    const w = await make();
    expect(w.find('section').exists()).toBe(false);
  });

  it('records the current product and shows previously-viewed others', async () => {
    localStorage.setItem(KEY, JSON.stringify([other]));
    const w = await make();
    expect(w.find('section').exists()).toBe(true);
    expect(w.text()).toContain('Вы смотрели');
    expect(w.text()).toContain('Other');
    expect(w.text()).not.toContain('Current');
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored[0].slug).toBe('current');
  });

  it('links to localized product pages and formats price', async () => {
    localStorage.setItem(KEY, JSON.stringify([other]));
    const w = await make();
    expect(w.find('a').attributes('href')).toBe('/ru/p/other');
    expect(w.text()).toContain('200');
  });

  it('builds a webp thumbnail from the original image url', async () => {
    localStorage.setItem(KEY, JSON.stringify([other]));
    const w = await make();
    expect(w.find('source').attributes('srcset')).toBe(
      'https://media.evix.md/p/other_200.webp',
    );
    expect(w.find('a img').attributes('src')).toBe(other.image);
  });

  it('shows the no-photo placeholder for items without an image', async () => {
    localStorage.setItem(KEY, JSON.stringify([noImg]));
    const w = await make();
    expect(w.find('picture').exists()).toBe(false);
    expect(w.text()).toContain('нет фото');
  });

  it('dedupes by slug so a re-viewed product is not duplicated', async () => {
    localStorage.setItem(KEY, JSON.stringify([current, other]));
    const w = await make();
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.filter((c: { slug: string }) => c.slug === 'current')).toHaveLength(1);
    expect(w.findAll('a')).toHaveLength(1); // only "other" shown
  });

  it('uses the ro heading for the ro locale', async () => {
    localStorage.setItem(KEY, JSON.stringify([other]));
    const w = await make('ro');
    expect(w.text()).toContain('Ați vizualizat');
  });

  it('survives corrupt localStorage data (keeps empty history)', async () => {
    localStorage.setItem(KEY, '{not json');
    const w = await make();
    expect(w.find('section').exists()).toBe(false);
  });

  it('is non-fatal when localStorage writes throw (quota / private mode)', async () => {
    localStorage.setItem(KEY, JSON.stringify([other]));
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const w = await make();
    expect(w.text()).toContain('Other');
    spy.mockRestore();
  });
});
