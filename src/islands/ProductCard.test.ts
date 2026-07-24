import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';

import ProductCard from './ProductCard.vue';
import type { ProductCard as Card } from '../api/catalog';

const base: Card = {
  slug: 'reg-4k',
  name: 'Видеорегистратор 4K',
  price: '1990',
  old_price: null,
  main_image_url: 'https://media.evix.md/p/reg-4k.jpg',
  in_stock: true,
  badge: null,
} as unknown as Card;

function make(overrides: Partial<Card> = {}) {
  return mount(ProductCard, {
    props: { product: { ...base, ...overrides }, lang: 'ru' },
  });
}

describe('ProductCard', () => {
  it('links to the localized product page', () => {
    const w = make();
    expect(w.find('a').attributes('href')).toBe('/ru/p/reg-4k');
  });

  it('renders name and formatted price', () => {
    const w = make();
    expect(w.text()).toContain('Видеорегистратор 4K');
    expect(w.text()).toContain('990');
  });

  it('renders an image with webp source when main_image_url is set', () => {
    const w = make();
    expect(w.find('picture').exists()).toBe(true);
    expect(w.find('source').attributes('srcset')).toContain('.webp');
    expect(w.find('img').attributes('alt')).toBe('Видеорегистратор 4K');
    expect(w.text()).not.toContain('нет фото');
  });

  it('shows a placeholder when there is no image', () => {
    const w = make({ main_image_url: null });
    expect(w.find('picture').exists()).toBe(false);
    expect(w.text()).toContain('нет фото');
  });

  it('renders the badge when present', () => {
    const w = make({ badge: '-20%' });
    expect(w.text()).toContain('-20%');
  });

  it('omits the badge when absent', () => {
    expect(make({ badge: null }).html()).not.toContain('badge-sale-bg');
  });

  it('shows old_price with a strike-through when present', () => {
    const w = make({ old_price: '2490' });
    expect(w.find('.line-through').exists()).toBe(true);
    expect(w.find('.line-through').text()).toContain('490');
  });

  it('hides old_price when absent', () => {
    expect(make({ old_price: null }).find('.line-through').exists()).toBe(
      false,
    );
  });

  it('shows in-stock label when in_stock is true', () => {
    expect(make({ in_stock: true }).text()).toContain('В наличии');
  });

  it('shows out-of-stock label when in_stock is false', () => {
    expect(make({ in_stock: false }).text()).toContain('Нет в наличии');
  });
});
