import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import CatalogMenu from './CatalogMenu.vue';
import type { CategoryNode } from '../api/catalog';

function node(
  id: number,
  slug: string,
  name: string,
  product_count: number,
  children: CategoryNode[] = [],
): CategoryNode {
  return {
    id,
    parent_id: null,
    name,
    slug,
    depth: 0,
    position: 0,
    product_count,
    children,
  };
}

const TREE: CategoryNode[] = [
  node(1, 'kuhnya', 'Кухня', 145, [
    node(2, 'raf', 'RAF', 9),
    // Empty child: must not be offered.
    node(3, 'duhi', 'Духи', 0),
  ]),
  // Empty root: must not be offered either.
  node(4, 'pusto', 'Пусто', 0),
];

function factory(categories: CategoryNode[] = TREE) {
  return mount(CatalogMenu, {
    props: { lang: 'ru' as const, categories },
    attachTo: document.body,
  });
}

beforeEach(() => {
  // happy-dom has no matchMedia; default to the desktop branch.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});

describe('CatalogMenu', () => {
  it('renders the trigger as a real link to the hub', () => {
    const wrapper = factory();
    const trigger = wrapper.get('a');
    // Without JS (or before hydration) this is what the browser follows.
    expect(trigger.attributes('href')).toBe('/ru/c');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('#catalog-menu-panel').exists()).toBe(false);
  });

  it('opens the panel on click instead of navigating', async () => {
    const wrapper = factory();
    const preventDefault = vi.fn();

    await wrapper.get('a').trigger('click', { preventDefault });

    // Also proves the spy really shadows the native method — without this the
    // "does not intercept" test below would pass vacuously.
    expect(preventDefault).toHaveBeenCalled();
    expect(wrapper.find('#catalog-menu-panel').exists()).toBe(true);
    expect(wrapper.get('a').attributes('aria-expanded')).toBe('true');
  });

  it('lists non-empty categories only, with counts and links', async () => {
    const wrapper = factory();
    await wrapper.get('a').trigger('click');

    const panel = wrapper.get('#catalog-menu-panel');
    const hrefs = panel.findAll('a').map((a) => a.attributes('href'));
    expect(hrefs).toContain('/ru/c/kuhnya');
    expect(hrefs).toContain('/ru/c/raf');
    // Empty categories are dead ends — no link is offered.
    expect(hrefs).not.toContain('/ru/c/duhi');
    expect(hrefs).not.toContain('/ru/c/pusto');
    expect(panel.text()).toContain('145');
    // The hub link stays reachable from inside the menu.
    expect(hrefs).toContain('/ru/c');
  });

  it('closes on a second click and on Escape, returning focus', async () => {
    const wrapper = factory();
    await wrapper.get('a').trigger('click');
    await wrapper.get('a').trigger('click');
    expect(wrapper.find('#catalog-menu-panel').exists()).toBe(false);

    await wrapper.get('a').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#catalog-menu-panel').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('a').element);
  });

  it('closes on a click outside the menu', async () => {
    const wrapper = factory();
    await wrapper.get('a').trigger('click');

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#catalog-menu-panel').exists()).toBe(false);
  });

  it('does not intercept the click when there is nothing to show', async () => {
    const wrapper = factory([]);
    const preventDefault = vi.fn();

    await wrapper.get('a').trigger('click', { preventDefault });

    // The backend is down or the store is empty → follow the link to the hub.
    expect(preventDefault).not.toHaveBeenCalled();
    expect(wrapper.find('#catalog-menu-panel').exists()).toBe(false);
  });

  it('locks page scroll only for the mobile drawer', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const wrapper = factory();

    await wrapper.get('a').trigger('click');
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.get('a').trigger('click');
    expect(document.body.style.overflow).toBe('');
  });
});
