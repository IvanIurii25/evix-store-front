import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import BannerCarousel from './BannerCarousel.vue';
import type { Banner } from '../api/site';

function banner(id: number, over: Partial<Banner> = {}): Banner {
  return {
    id,
    image_url: `https://media.evix.md/media/b${id}.jpg`,
    image_mobile_url: `https://media.evix.md/media/b${id}-m.jpg`,
    alt: `Баннер ${id}`,
    title: null,
    subtitle: null,
    cta_label: null,
    link_url: `/ru/c/dom`,
    ...over,
  };
}

function factory(banners: Banner[]) {
  return mount(BannerCarousel, {
    props: { lang: 'ru' as const, banners },
    attachTo: document.body,
  });
}

let reduced = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduced })),
  );
  // happy-dom has no scrollTo on elements.
  Element.prototype.scrollTo =
    vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  reduced = false;
});

describe('BannerCarousel', () => {
  it('renders every slide as real content with its own alt', () => {
    const wrapper = factory([banner(1), banner(2)]);

    const imgs = wrapper.findAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs.map((i) => i.attributes('alt'))).toEqual([
      'Баннер 1',
      'Баннер 2',
    ]);
  });

  it('prioritises only the first image', () => {
    const wrapper = factory([banner(1), banner(2)]);

    const imgs = wrapper.findAll('img');
    // The first slide is the LCP candidate; the rest must not compete with it.
    expect(imgs[0].attributes('loading')).toBe('eager');
    expect(imgs[0].attributes('fetchpriority')).toBe('high');
    expect(imgs[1].attributes('loading')).toBe('lazy');
    expect(imgs[1].attributes('fetchpriority')).toBeUndefined();
  });

  it('wraps a slide in a link only when it has one', () => {
    const wrapper = factory([banner(1), banner(2, { link_url: null })]);

    const slides = wrapper.findAll('[data-index]');
    expect(slides[0].element.tagName).toBe('A');
    expect(slides[0].attributes('href')).toBe('/ru/c/dom');
    // A banner without a target must not become an empty anchor.
    expect(slides[1].element.tagName).toBe('DIV');
  });

  it('serves the narrow-screen creative when one was uploaded', () => {
    const wrapper = factory([banner(1), banner(2, { image_mobile_url: null })]);

    const sources = wrapper.findAll('source');
    const mobile = sources.filter(
      (s) => s.attributes('media') === '(max-width: 767px)',
    );
    // Two <source> per mobile creative (webp + original), for one banner only.
    expect(mobile).toHaveLength(2);
    expect(mobile[0].attributes('srcset')).toContain('b1-m_800.webp');
  });

  it('hides the controls for a single banner', () => {
    const wrapper = factory([banner(1)]);

    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('shows one dot per banner and marks the current one', async () => {
    const wrapper = factory([banner(1), banner(2), banner(3)]);

    const dots = wrapper.findAll('[aria-label^="Баннер "]');
    expect(dots).toHaveLength(3);
    expect(dots[0].attributes('aria-current')).toBe('true');

    await dots[2].trigger('click');

    expect(
      wrapper.findAll('[aria-label^="Баннер "]')[2].attributes('aria-current'),
    ).toBe('true');
  });

  it('advances on autoplay and wraps around the end', async () => {
    const wrapper = factory([banner(1), banner(2)]);
    const track = wrapper.get('[data-index]').element
      .parentElement as HTMLElement;
    const scrollTo = track.scrollTo as unknown as ReturnType<typeof vi.fn>;

    vi.advanceTimersByTime(6000);
    await wrapper.vm.$nextTick();
    expect(scrollTo).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6000);
    await wrapper.vm.$nextTick();
    // Back to the first slide rather than scrolling past the end.
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ left: 0 }),
    );
  });

  it('stops autoplay while the pointer is over the carousel', async () => {
    const wrapper = factory([banner(1), banner(2)]);
    const track = wrapper.get('[data-index]').element
      .parentElement as HTMLElement;
    const scrollTo = track.scrollTo as unknown as ReturnType<typeof vi.fn>;

    await wrapper.get('section').trigger('mouseenter');
    vi.advanceTimersByTime(18000);

    expect(scrollTo).not.toHaveBeenCalled();

    await wrapper.get('section').trigger('mouseleave');
    vi.advanceTimersByTime(6000);
    expect(scrollTo).toHaveBeenCalled();
  });

  it('does not autoplay when the visitor asked for reduced motion', () => {
    reduced = true;
    const wrapper = factory([banner(1), banner(2)]);
    const track = wrapper.get('[data-index]').element
      .parentElement as HTMLElement;
    const scrollTo = track.scrollTo as unknown as ReturnType<typeof vi.fn>;

    vi.advanceTimersByTime(30000);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('renders overlay copy only when the manager filled it in', () => {
    const plain = factory([banner(1)]);
    expect(plain.text()).toBe('');

    const withCopy = factory([
      banner(2, { title: 'Летняя распродажа', cta_label: 'Смотреть' }),
    ]);
    expect(withCopy.text()).toContain('Летняя распродажа');
    expect(withCopy.text()).toContain('Смотреть');
  });
});
