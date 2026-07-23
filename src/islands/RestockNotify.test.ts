import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import RestockNotify from './RestockNotify.vue';
import {
  getRestockStatus,
  subscribeRestock,
  unsubscribeRestock,
} from '../api/restock';

vi.mock('../api/restock', () => ({
  getRestockStatus: vi.fn(),
  subscribeRestock: vi.fn(),
  unsubscribeRestock: vi.fn(),
}));

const mockStatus = vi.mocked(getRestockStatus);
const mockSub = vi.mocked(subscribeRestock);
const mockUnsub = vi.mocked(unsubscribeRestock);

let originalLocation: Location;
const replaceState = vi.fn();

function setUrl(href: string) {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      href,
      search: url.search,
      pathname: url.pathname,
      origin: url.origin,
    },
  });
}

beforeEach(() => {
  mockStatus.mockReset();
  mockSub.mockReset();
  mockUnsub.mockReset();
  replaceState.mockReset();
  originalLocation = window.location;
  setUrl('https://shop.evix.md/ru/p/slug');
  vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState);
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

const props = { productId: 42, lang: 'ru' as const, productPath: '/ru/p/slug' };

describe('RestockNotify', () => {
  it('shows a disabled loading button before status resolves', () => {
    mockStatus.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(RestockNotify, { props });
    expect(w.find('button').attributes('disabled')).toBeDefined();
    expect(w.find('button').text()).toContain('…');
  });

  it('lands on the idle notify state for an authed, unsubscribed user', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    const w = mount(RestockNotify, { props });
    await flushPromises();
    expect(w.find('button').text()).toContain('Уведомить о поступлении');
    expect(w.find('button').attributes('disabled')).toBeUndefined();
  });

  it('shows the subscribed state when already subscribed', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: true });
    const w = mount(RestockNotify, { props });
    await flushPromises();
    expect(w.text()).toContain('Вы подписаны ✓');
    expect(w.text()).toContain('Отписаться'); // hover-swap label present
  });

  it('subscribes on click from the idle state', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    mockSub.mockResolvedValue('ok');
    const w = mount(RestockNotify, { props });
    await flushPromises();
    await w.find('button').trigger('click');
    await flushPromises();
    expect(mockSub).toHaveBeenCalledWith(42, 'ru');
    expect(w.text()).toContain('Вы подписаны ✓');
  });

  it('returns to idle when the subscribe call is not ok', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    mockSub.mockResolvedValue('error');
    const w = mount(RestockNotify, { props });
    await flushPromises();
    await w.find('button').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Уведомить о поступлении');
  });

  it('unsubscribes on click from the subscribed state', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: true });
    mockUnsub.mockResolvedValue(undefined);
    const w = mount(RestockNotify, { props });
    await flushPromises();
    await w.find('button').trigger('click');
    await flushPromises();
    expect(mockUnsub).toHaveBeenCalledWith(42);
    expect(w.text()).toContain('Уведомить о поступлении');
  });

  it('routes a guest to login carrying the product + intent as next', async () => {
    mockStatus.mockResolvedValue({ authed: false, subscribed: false });
    const w = mount(RestockNotify, { props });
    await flushPromises();
    // guest state -> click sends to login
    await w.find('button').trigger('click');
    expect(window.location.href).toContain('/ru/auth?next=');
    expect(decodeURIComponent(window.location.href)).toContain('/ru/p/slug?notify=1');
  });

  it('auto-subscribes and cleans the intent flag after login redirect', async () => {
    setUrl('https://shop.evix.md/ru/p/slug?notify=1');
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    mockSub.mockResolvedValue('ok');
    const w = mount(RestockNotify, { props });
    await flushPromises();
    expect(replaceState).toHaveBeenCalled(); // notify=1 stripped from URL
    expect(mockSub).toHaveBeenCalledWith(42, 'ru');
    expect(w.text()).toContain('Вы подписаны ✓');
  });

  it('when a guest subscribe returns guest, redirects to login', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    mockSub.mockResolvedValue('guest');
    const w = mount(RestockNotify, { props });
    await flushPromises();
    await w.find('button').trigger('click');
    await flushPromises();
    expect(window.location.href).toContain('/ru/auth?next=');
  });

  it('renders the ro helper copy for the ro locale', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    const w = mount(RestockNotify, {
      props: { ...props, lang: 'ro' },
    });
    await flushPromises();
    expect(w.text()).toContain('Îți trimitem un e-mail');
    expect(w.text()).toContain('Anunță-mă când apare');
  });

  it('renders the ru helper copy for the ru locale', async () => {
    mockStatus.mockResolvedValue({ authed: true, subscribed: false });
    const w = mount(RestockNotify, { props });
    await flushPromises();
    expect(w.text()).toContain('Пришлём письмо');
  });
});
