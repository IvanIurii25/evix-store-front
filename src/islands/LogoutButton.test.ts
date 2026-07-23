import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import LogoutButton from './LogoutButton.vue';
import { logout } from '../api/auth';

vi.mock('../api/auth', () => ({ logout: vi.fn() }));

const mockLogout = vi.mocked(logout);

let originalLocation: Location;

beforeEach(() => {
  mockLogout.mockReset();
  originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...originalLocation, href: '' },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

// Smoke test: proves the Vitest + happy-dom + @vue/test-utils + Astro-Vue
// pipeline compiles and mounts a real island SFC with props and i18n imports.
describe('LogoutButton', () => {
  it('renders a button with a non-empty localized label', () => {
    const wrapper = mount(LogoutButton, { props: { lang: 'ro' } });
    expect(wrapper.find('button').exists()).toBe(true);
    expect(wrapper.text().length).toBeGreaterThan(0);
  });

  it('calls logout and redirects to the localized home on click', async () => {
    mockLogout.mockResolvedValue(undefined as never);
    const w = mount(LogoutButton, { props: { lang: 'ru' } });
    await w.find('button').trigger('click');
    await flushPromises();
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/ru');
  });

  it('disables the button and shows a spinner while logging out', async () => {
    let resolve!: () => void;
    mockLogout.mockReturnValue(new Promise<void>((r) => (resolve = r)) as never);
    const w = mount(LogoutButton, { props: { lang: 'ro' } });
    await w.find('button').trigger('click');
    expect(w.find('button').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('…');
    resolve();
    await flushPromises();
  });

  it('still redirects even if logout rejects (finally block)', async () => {
    // The component has no catch — its handler's promise rejects after the
    // finally redirect. Capture that rejection at the process level so it
    // doesn't surface as an unhandled rejection failing the run.
    const rejections: unknown[] = [];
    const onRej = (r: unknown) => rejections.push(r);
    process.on('unhandledRejection', onRej);
    mockLogout.mockRejectedValue(new Error('network'));
    const w = mount(LogoutButton, { props: { lang: 'ro' } });
    await w.find('button').trigger('click').catch(() => {});
    await flushPromises();
    await new Promise((r) => setTimeout(r, 0)); // let the microtask reject
    process.off('unhandledRejection', onRej);
    expect(window.location.href).toBe('/ro');
  });
});
