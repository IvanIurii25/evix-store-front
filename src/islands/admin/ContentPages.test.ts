import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listContentPages = vi.fn();
const createContentPage = vi.fn();
const updateContentPage = vi.fn();
const deleteContentPage = vi.fn();

vi.mock('../../api/admin', () => ({
  listContentPages: (...a: unknown[]) => listContentPages(...a),
  createContentPage: (...a: unknown[]) => createContentPage(...a),
  updateContentPage: (...a: unknown[]) => updateContentPage(...a),
  deleteContentPage: (...a: unknown[]) => deleteContentPage(...a),
}));

import ContentPages from './ContentPages.vue';

function page(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'delivery',
    is_published: true,
    show_in_footer: true,
    position: 3,
    translations: [
      {
        lang: 'ru',
        title: 'Доставка',
        body: '# Тело',
        seo_description: 'seo-ru',
      },
      { lang: 'ro', title: 'Livrare', body: 'Corp', seo_description: null },
    ],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

async function mounted(pages: unknown[]) {
  listContentPages.mockResolvedValueOnce(pages);
  const wrapper = mount(ContentPages);
  await flushPromises();
  return wrapper;
}

const byText = (w: ReturnType<typeof mount>, t: string) =>
  w.findAll('button').find((b) => b.text() === t)!;

describe('ContentPages', () => {
  it('shows loading first, then the populated list', async () => {
    let resolve!: (v: unknown[]) => void;
    listContentPages.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const wrapper = mount(ContentPages);
    expect(wrapper.text()).toContain('Загрузка…');

    resolve([page()]);
    await flushPromises();
    expect(wrapper.text()).toContain('delivery');
    expect(wrapper.text()).toContain('Доставка');
  });

  it('renders the empty list state', async () => {
    const wrapper = await mounted([]);
    expect(wrapper.text()).toContain('Страниц пока нет');
  });

  it('renders the load error and its non-Error fallback', async () => {
    listContentPages.mockRejectedValueOnce(new Error('load-boom'));
    const wrapper = mount(ContentPages);
    await flushPromises();
    expect(wrapper.text()).toContain('load-boom');

    listContentPages.mockRejectedValueOnce('x');
    const wrapper2 = mount(ContentPages);
    await flushPromises();
    expect(wrapper2.text()).toContain('Ошибка загрузки');
  });

  it('creates a new page from a blank editor form', async () => {
    const wrapper = await mounted([]);
    await byText(wrapper, '+ Новая страница').trigger('click');

    // slug + first title
    const textInputs = wrapper.findAll('input[type="text"]');
    await textInputs[0].setValue('returns'); // slug
    await textInputs[1].setValue('Возвраты'); // RU title
    await wrapper.find('textarea').setValue('body ru');

    listContentPages.mockResolvedValueOnce([page({ id: 2, slug: 'returns' })]);
    createContentPage.mockResolvedValueOnce({});
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createContentPage).toHaveBeenCalledTimes(1);
    const body = createContentPage.mock.calls[0][0];
    expect(body.slug).toBe('returns');
    expect(body.translations).toHaveLength(2);
    expect(body.translations[0]).toMatchObject({
      lang: 'ru',
      title: 'Возвраты',
    });
    // seo_description empty -> null
    expect(body.translations[0].seo_description).toBeNull();
    expect(updateContentPage).not.toHaveBeenCalled();
    // back to list
    expect(wrapper.text()).toContain('Инфо/юридические страницы');
  });

  it('edits an existing page (prefilled) and updates it', async () => {
    const wrapper = await mounted([page()]);
    await byText(wrapper, 'Изменить').trigger('click');

    const slug = wrapper.findAll('input[type="text"]')[0];
    expect((slug.element as HTMLInputElement).value).toBe('delivery');

    // switch to RO tab (branch) then back to RU
    await byText(wrapper, 'RO').trigger('click');
    await byText(wrapper, 'RU').trigger('click');

    // fill a seo description so the non-null branch is taken
    const seo = wrapper.findAll('textarea')[1];
    await seo.setValue('updated seo');

    listContentPages.mockResolvedValueOnce([page()]);
    updateContentPage.mockResolvedValueOnce({});
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(updateContentPage).toHaveBeenCalledTimes(1);
    expect(updateContentPage.mock.calls[0][0]).toBe(1); // editingId
    const body = updateContentPage.mock.calls[0][1];
    expect(body.translations[0].seo_description).toBe('updated seo');
  });

  it('surfaces a save error and its non-Error fallback', async () => {
    const wrapper = await mounted([]);
    await byText(wrapper, '+ Новая страница').trigger('click');

    createContentPage.mockRejectedValueOnce(new Error('save-boom'));
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('save-boom');

    createContentPage.mockRejectedValueOnce('x');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Не удалось сохранить');
  });

  it('toggles publish + footer checkboxes into the saved body', async () => {
    const wrapper = await mounted([]);
    await byText(wrapper, '+ Новая страница').trigger('click');

    const checks = wrapper.findAll('input[type="checkbox"]');
    // defaults true -> uncheck both
    await checks[0].setValue(false); // is_published
    await checks[1].setValue(false); // show_in_footer

    listContentPages.mockResolvedValueOnce([]);
    createContentPage.mockResolvedValueOnce({});
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const body = createContentPage.mock.calls[0][0];
    expect(body.is_published).toBe(false);
    expect(body.show_in_footer).toBe(false);
  });

  it('toggles the Markdown preview and renders HTML', async () => {
    const wrapper = await mounted([]);
    await byText(wrapper, '+ Новая страница').trigger('click');
    await wrapper.find('textarea').setValue('## Heading');

    // Editor shows the textarea; Превью swaps to rendered html
    expect(wrapper.find('textarea').exists()).toBe(true);
    await byText(wrapper, 'Превью').trigger('click');
    expect(wrapper.find('.prose-content').exists()).toBe(true);
    expect(wrapper.find('.prose-content').html()).toContain('<h2>');

    // toggle back to editor
    await byText(wrapper, 'Редактор').trigger('click');
    expect(wrapper.find('textarea').exists()).toBe(true);
  });

  it('cancels the editor back to the list', async () => {
    const wrapper = await mounted([page()]);
    await byText(wrapper, 'Изменить').trigger('click');
    expect(wrapper.find('form').exists()).toBe(true);
    await byText(wrapper, 'Отмена').trigger('click');
    expect(wrapper.text()).toContain('Инфо/юридические страницы');
  });

  it('deletes a page after confirm and reloads', async () => {
    window.confirm = vi.fn(() => true);
    const wrapper = await mounted([page()]);
    listContentPages.mockResolvedValueOnce([]);
    deleteContentPage.mockResolvedValueOnce(undefined);
    await byText(wrapper, 'Удалить').trigger('click');
    await flushPromises();
    expect(deleteContentPage).toHaveBeenCalledWith(1);
    expect(wrapper.text()).toContain('Страниц пока нет');
  });

  it('does not delete when the confirm is declined', async () => {
    window.confirm = vi.fn(() => false);
    const wrapper = await mounted([page()]);
    await byText(wrapper, 'Удалить').trigger('click');
    await flushPromises();
    expect(deleteContentPage).not.toHaveBeenCalled();
  });

  it('surfaces a delete error and its non-Error fallback', async () => {
    window.confirm = vi.fn(() => true);
    const wrapper = await mounted([page()]);

    deleteContentPage.mockRejectedValueOnce(new Error('del-boom'));
    await byText(wrapper, 'Удалить').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('del-boom');

    const wrapper2 = await mounted([page()]);
    deleteContentPage.mockRejectedValueOnce('x');
    await byText(wrapper2, 'Удалить').trigger('click');
    await flushPromises();
    expect(wrapper2.text()).toContain('Не удалось удалить');
  });

  it('handles a page whose translations are missing (resetForm defaults)', async () => {
    const wrapper = await mounted([page({ translations: [] })]);
    await byText(wrapper, 'Изменить').trigger('click');
    const title = wrapper.findAll('input[type="text"]')[1];
    expect((title.element as HTMLInputElement).value).toBe('');
  });
});
