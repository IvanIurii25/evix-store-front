import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import SeoSettings from './SeoSettings.vue';
import { getSeo, putSeo, type SeoSettings as Seo } from '../../api/admin';

vi.mock('../../api/admin', () => ({
  getSeo: vi.fn(),
  putSeo: vi.fn(),
}));

const mockGet = vi.mocked(getSeo);
const mockPut = vi.mocked(putSeo);

const seo = (over: Partial<Seo> = {}): Seo => ({
  title_ru: 'Заголовок',
  title_ro: 'Titlu',
  description_ru: 'Описание',
  description_ro: 'Descriere',
  title_suffix: ' — evix',
  og_image_url: 'https://cdn/og.png',
  ...over,
});

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('SeoSettings', () => {
  it('shows a loading state before the settings resolve', () => {
    mockGet.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(SeoSettings);
    expect(w.text()).toContain('Загрузка');
  });

  it('loads the settings and fills the form inputs', async () => {
    mockGet.mockResolvedValue(seo());
    const w = mount(SeoSettings);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledOnce();
    const inputs = w.findAll('input');
    expect((inputs[0].element as HTMLInputElement).value).toBe('Заголовок');
    expect((inputs[1].element as HTMLInputElement).value).toBe('Titlu');
    const textareas = w.findAll('textarea');
    expect((textareas[0].element as HTMLTextAreaElement).value).toBe(
      'Описание',
    );
  });

  it('binds every field two-way and submits the full edited payload', async () => {
    mockGet.mockResolvedValue(seo());
    mockPut.mockImplementation(async (body) => body);
    const w = mount(SeoSettings);
    await flushPromises();

    // Exercise the v-model setter for each of the four inputs + two textareas.
    const inputs = w.findAll('input');
    await inputs[0].setValue('T-RU');
    await inputs[1].setValue('T-RO');
    await inputs[2].setValue(' — suffix'); // title_suffix
    await inputs[3].setValue('https://cdn/new.png'); // og_image_url
    const textareas = w.findAll('textarea');
    await textareas[0].setValue('D-RU');
    await textareas[1].setValue('D-RO');

    await w.find('form').trigger('submit');
    await flushPromises();

    expect(mockPut).toHaveBeenCalledWith({
      title_ru: 'T-RU',
      title_ro: 'T-RO',
      title_suffix: ' — suffix',
      og_image_url: 'https://cdn/new.png',
      description_ru: 'D-RU',
      description_ro: 'D-RO',
    });
  });

  it('shows the load-error state when the request fails', async () => {
    mockGet.mockRejectedValue(new Error('load boom'));
    const w = mount(SeoSettings);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('load boom');
    expect(w.find('form').exists()).toBe(false);
  });

  it('uses a fallback message for non-Error load rejections', async () => {
    mockGet.mockRejectedValue('x');
    const w = mount(SeoSettings);
    await flushPromises();
    expect(w.find('.text-danger').text()).toContain('Ошибка загрузки');
  });

  it('saves the edited form, echoes the server copy, and shows a toast that auto-dismisses', async () => {
    mockGet.mockResolvedValue(seo());
    mockPut.mockImplementation(async (body) => body);
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockReturnValue(0 as never);
    const w = mount(SeoSettings);
    await flushPromises();

    const inputs = w.findAll('input');
    await inputs[0].setValue('Новый заголовок');
    await w.find('form').trigger('submit');
    await flushPromises();

    // Round-trip: the edited value is sent to putSeo.
    expect(mockPut).toHaveBeenCalledWith(
      expect.objectContaining({ title_ru: 'Новый заголовок' }),
    );
    expect(w.text()).toContain('Настройки сохранены');

    // The auto-dismiss timer was scheduled at 2.5s; fire its callback manually.
    const dismiss = setTimeoutSpy.mock.calls.at(-1);
    expect(dismiss?.[1]).toBe(2500);
    (dismiss?.[0] as () => void)();
    await flushPromises();
    expect(w.text()).not.toContain('Настройки сохранены');
    setTimeoutSpy.mockRestore();
  });

  it('shows the save-error state and no toast when the save fails', async () => {
    mockGet.mockResolvedValue(seo());
    mockPut.mockRejectedValue(new Error('save boom'));
    const w = mount(SeoSettings);
    await flushPromises();

    await w.find('form').trigger('submit');
    await flushPromises();

    expect(w.text()).toContain('save boom');
    expect(w.text()).not.toContain('Настройки сохранены');
  });

  it('uses a fallback message for non-Error save rejections', async () => {
    mockGet.mockResolvedValue(seo());
    mockPut.mockRejectedValue('x');
    const w = mount(SeoSettings);
    await flushPromises();
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Не удалось сохранить');
  });
});
