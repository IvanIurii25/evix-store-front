import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';

import ProductTabs from './ProductTabs.vue';

const attrs = [
  { name: 'Разрешение', values: ['4K', '2K'] },
  { name: 'Бренд', values: null },
];

describe('ProductTabs', () => {
  it('renders nothing when there is neither description nor attributes', () => {
    const w = mount(ProductTabs, { props: { description: null, attributes: [] } });
    expect(w.find('div.mt-8').exists()).toBe(false);
  });

  it('shows both tabs and defaults to description when a description exists', () => {
    const w = mount(ProductTabs, {
      props: { description: '<p>Hello</p>', attributes: attrs },
    });
    const tabs = w.findAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(tabs[1].attributes('aria-selected')).toBe('false');
    // Description panel HTML is rendered via v-html.
    expect(w.find('.prod-description').html()).toContain('Hello');
  });

  it('defaults to the attributes tab when there is no description', () => {
    const w = mount(ProductTabs, { props: { description: '', attributes: attrs } });
    const tabs = w.findAll('[role="tab"]');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].text()).toBe('Характеристики');
    expect(tabs[0].attributes('aria-selected')).toBe('true');
  });

  it('switches to the attributes tab on click', async () => {
    const w = mount(ProductTabs, {
      props: { description: '<p>Hi</p>', attributes: attrs },
    });
    const tabs = w.findAll('[role="tab"]');
    // description tab starts active (border-primary), attributes inactive.
    expect(tabs[0].classes()).toContain('border-primary');
    expect(tabs[1].classes()).toContain('border-transparent');
    await tabs[1].trigger('click');
    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(tabs[1].classes()).toContain('text-ink');
    expect(tabs[1].classes()).toContain('border-primary');
    expect(tabs[0].attributes('aria-selected')).toBe('false');
    // description tab now rendered inactive.
    expect(tabs[0].classes()).toContain('border-transparent');
  });

  it('round-trips back to the description tab', async () => {
    const w = mount(ProductTabs, {
      props: { description: '<p>Hi</p>', attributes: attrs },
    });
    const tabs = w.findAll('[role="tab"]');
    await tabs[1].trigger('click'); // -> attributes
    await tabs[0].trigger('click'); // -> back to description
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(tabs[0].classes()).toContain('border-primary');
    expect(w.find('[role="tabpanel"].prod-description').isVisible()).toBe(true);
  });

  it('renders attribute rows, joining values and tolerating null values', () => {
    const w = mount(ProductTabs, { props: { description: null, attributes: attrs } });
    const rows = w.findAll('dl > div');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('dt').text()).toBe('Разрешение');
    expect(rows[0].find('dd').text()).toBe('4K, 2K');
    // null values -> empty join
    expect(rows[1].find('dd').text()).toBe('');
  });

  it('renders only the description tab when there are no attributes', () => {
    const w = mount(ProductTabs, {
      props: { description: '<p>Only</p>', attributes: null },
    });
    const tabs = w.findAll('[role="tab"]');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].text()).toBe('Описание');
  });
});
