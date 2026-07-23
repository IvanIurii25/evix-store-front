import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import LogoutButton from './LogoutButton.vue';

// Smoke test: proves the Vitest + happy-dom + @vue/test-utils + Astro-Vue
// pipeline compiles and mounts a real island SFC with props and i18n imports.
describe('LogoutButton', () => {
  it('renders a button with a non-empty localized label', () => {
    const wrapper = mount(LogoutButton, { props: { lang: 'ro' } });
    expect(wrapper.find('button').exists()).toBe(true);
    expect(wrapper.text().length).toBeGreaterThan(0);
  });
});
