import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONSENT_COOKIE } from '../lib/consent';
import ConsentBanner from './ConsentBanner.vue';

vi.mock('../config/env', () => ({ API_BASE: 'http://api.test' }));

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearCookies();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCookies();
});

describe('ConsentBanner', () => {
  it('shows two choices when no decision is stored', async () => {
    const wrapper = mount(ConsentBanner, { props: { lang: 'ro' } });
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.findAll('button')).toHaveLength(2);
  });

  it('stays hidden when a current-version decision is already stored', async () => {
    document.cookie = `${CONSENT_COOKIE}=1:all; Path=/`;
    const wrapper = mount(ConsentBanner, { props: { lang: 'ro' } });
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('accept-all stores analytics consent and posts proof', async () => {
    const wrapper = mount(ConsentBanner, { props: { lang: 'ro' } });
    await flushPromises();

    await wrapper.findAll('button')[1].trigger('click'); // "Accept all"

    expect(document.cookie).toContain(`${CONSENT_COOKIE}=1%3Aall`);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/consent');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.analytics).toBe(true);
    expect(body.action).toBe('accept_all');
    expect(body.source).toBe('banner');
    expect(body.lang).toBe('ro');
    expect(body.anonymous_id).toBeTruthy();
  });

  it('only-necessary stores a reject decision (analytics denied)', async () => {
    const wrapper = mount(ConsentBanner, { props: { lang: 'ru' } });
    await flushPromises();

    await wrapper.findAll('button')[0].trigger('click'); // "Only necessary"

    expect(document.cookie).toContain(`${CONSENT_COOKIE}=1%3Anecessary`);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.analytics).toBe(false);
    expect(body.action).toBe('reject_all');
  });

  it('reopens from the evix:open-consent event with source=settings', async () => {
    document.cookie = `${CONSENT_COOKIE}=1:all; Path=/`;
    const wrapper = mount(ConsentBanner, { props: { lang: 'ro' } });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    window.dispatchEvent(new Event('evix:open-consent'));
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);

    await wrapper.findAll('button')[0].trigger('click');
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.source).toBe('settings');
  });

  it('swallows a failed consent post (never breaks the page)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    const wrapper = mount(ConsentBanner, { props: { lang: 'ro' } });
    await flushPromises();

    await wrapper.findAll('button')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});
