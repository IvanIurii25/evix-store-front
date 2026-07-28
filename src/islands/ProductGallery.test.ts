import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';

import ProductGallery from './ProductGallery.vue';

const imgs = [
  { url: 'https://media.evix.md/p/a.jpg' },
  { url: 'https://media.evix.md/p/b.jpg' },
  { url: 'https://media.evix.md/p/c.jpg' },
];

describe('ProductGallery', () => {
  it('renders the first image as active on mount', () => {
    const w = mount(ProductGallery, { props: { images: imgs, alt: 'Alt' } });
    expect(w.find('.aspect-square img').attributes('src')).toBe(imgs[0].url);
    expect(w.find('.aspect-square img').attributes('alt')).toBe('Alt');
    expect(w.find('.aspect-square source').attributes('srcset')).toContain(
      '.webp',
    );
  });

  it('renders a thumbnail button per image when there is more than one', () => {
    const w = mount(ProductGallery, { props: { images: imgs, alt: 'Alt' } });
    expect(w.findAll('button')).toHaveLength(3);
  });

  it('switches the active image when a thumbnail is clicked', async () => {
    const w = mount(ProductGallery, { props: { images: imgs, alt: 'Alt' } });
    await w.findAll('button')[1].trigger('click');
    expect(w.find('.aspect-square img').attributes('src')).toBe(imgs[1].url);
    // The clicked thumbnail is highlighted.
    expect(w.findAll('button')[1].classes()).toContain('border-primary');
    expect(w.findAll('button')[0].classes()).toContain('border-fill');
  });

  it('hides the thumbnail strip for a single image', () => {
    const w = mount(ProductGallery, {
      props: { images: [imgs[0]], alt: 'Alt' },
    });
    expect(w.findAll('button')).toHaveLength(0);
  });

  it('shows the ru no-photo placeholder when images is empty', () => {
    const w = mount(ProductGallery, {
      props: { images: [], alt: 'Alt', lang: 'ru' },
    });
    expect(w.find('picture').exists()).toBe(false);
    expect(w.text()).toContain('нет фото');
  });

  it('localizes the no-photo placeholder to ro', () => {
    const w = mount(ProductGallery, {
      props: { images: [], alt: 'Alt', lang: 'ro' },
    });
    expect(w.text()).toContain('fără imagine');
  });
});
