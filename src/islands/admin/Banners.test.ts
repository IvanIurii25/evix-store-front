import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/admin', () => ({
  listBanners: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
  reorderBanners: vi.fn(),
  uploadAsset: vi.fn(),
}));

import Banners from './Banners.vue';
import * as adminApi from '../../api/admin';

const listBanners = vi.mocked(adminApi.listBanners);
const createBanner = vi.mocked(adminApi.createBanner);
const updateBanner = vi.mocked(adminApi.updateBanner);
const reorderBanners = vi.mocked(adminApi.reorderBanners);
const uploadAsset = vi.mocked(adminApi.uploadAsset);

const HOUR = 60 * 60 * 1000;

function banner(over: Partial<adminApi.BannerAdminOut> = {}) {
  return {
    id: 1,
    position: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    link_url: '/ru/c/dom',
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    translations: [
      {
        lang: 'ru',
        image_url: 'https://media.evix.md/media/b1.jpg',
        image_mobile_url: null,
        alt: 'Летняя распродажа',
        title: null,
        subtitle: null,
        cta_label: null,
      },
      {
        lang: 'ro',
        image_url: 'https://media.evix.md/media/b1-ro.jpg',
        image_mobile_url: null,
        alt: 'Reduceri',
        title: null,
        subtitle: null,
        cta_label: null,
      },
    ],
    ...over,
  } as adminApi.BannerAdminOut;
}

async function factory(items = [banner()]) {
  listBanners.mockResolvedValue(items);
  const wrapper = mount(Banners);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  listBanners.mockResolvedValue([]);
  reorderBanners.mockResolvedValue([]);
});

describe('admin Banners', () => {
  it('tells the manager what the storefront will do with each banner', async () => {
    const now = Date.now();
    const wrapper = await factory([
      banner({ id: 1, is_active: false }),
      banner({ id: 2, starts_at: new Date(now + HOUR).toISOString() }),
      banner({ id: 3, ends_at: new Date(now - HOUR).toISOString() }),
      banner({ id: 4 }),
    ]);

    const rows = wrapper.findAll('li').map((li) => li.text());
    expect(rows[0]).toContain('Выключен');
    expect(rows[1]).toContain('Запланирован');
    expect(rows[2]).toContain('Истёк');
    expect(rows[3]).toContain('Показывается');
  });

  it('says so when there are no banners at all', async () => {
    const wrapper = await factory([]);

    expect(wrapper.text()).toContain(
      'на главной показывается стандартный блок',
    );
  });

  it('blocks saving until both languages have an image and an alt', async () => {
    const wrapper = await factory([]);
    await wrapper.get('button').trigger('click'); // Добавить баннер

    const save = wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Сохранить'))!;
    expect(save.attributes('disabled')).toBeDefined();
    // The gap is named per language, not discovered as a 422 after saving.
    expect(wrapper.text()).toContain('RU: картинка');
    expect(wrapper.text()).toContain('RO: alt');
  });

  it('submits both languages in one payload', async () => {
    createBanner.mockResolvedValue(banner());
    const wrapper = await factory([]);
    await wrapper.get('button').trigger('click');

    // Fill RU, then switch tabs and fill RO — one draft, two views.
    uploadAsset.mockResolvedValue('https://media.evix.md/media/ru.jpg');
    const vm = wrapper.vm as unknown as {
      draft: {
        translations: Record<string, { image_url: string; alt: string }>;
      };
      tab: string;
    };
    vm.draft.translations.ru.image_url = 'https://media.evix.md/media/ru.jpg';
    vm.draft.translations.ru.alt = 'Распродажа';
    vm.draft.translations.ro.image_url = 'https://media.evix.md/media/ro.jpg';
    vm.draft.translations.ro.alt = 'Reduceri';
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Сохранить'))!
      .trigger('click');
    await flushPromises();

    expect(createBanner).toHaveBeenCalledTimes(1);
    const body = createBanner.mock.calls[0][0];
    expect(body.translations.map((t) => t.lang)).toEqual(['ru', 'ro']);
    expect(body.translations[1].alt).toBe('Reduceri');
    // An empty link field is null, not an empty string the API would reject.
    expect(body.link_url).toBeNull();
  });

  it('loads an existing banner into the editor and updates it', async () => {
    updateBanner.mockResolvedValue(banner());
    const wrapper = await factory([banner()]);

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Изменить')!
      .trigger('click');
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Сохранить'))!
      .trigger('click');
    await flushPromises();

    expect(updateBanner).toHaveBeenCalledWith(1, expect.anything());
    const body = updateBanner.mock.calls[0][1];
    expect(body.link_url).toBe('/ru/c/dom');
    expect(body.translations.map((t) => t.alt)).toEqual([
      'Летняя распродажа',
      'Reduceri',
    ]);
  });

  it('renumbers every banner when one is moved', async () => {
    const wrapper = await factory([
      banner({ id: 1, position: 0 }),
      banner({ id: 2, position: 1 }),
    ]);

    await wrapper.findAll('button[aria-label="Ниже"]')[0].trigger('click');
    await flushPromises();

    // Positions are rewritten from the new order, so they stay 0..n-1 rather
    // than drifting into gaps after a few moves.
    expect(reorderBanners).toHaveBeenCalledWith([
      { banner_id: 2, position: 0 },
      { banner_id: 1, position: 1 },
    ]);
  });

  it('surfaces a failed save instead of silently doing nothing', async () => {
    updateBanner.mockRejectedValue(new Error('Ссылка недопустима'));
    const wrapper = await factory([banner()]);

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Изменить')!
      .trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Сохранить'))!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Ссылка недопустима');
  });
});
