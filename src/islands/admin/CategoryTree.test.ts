import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

import CategoryTree from './CategoryTree.vue';
import {
  createCategory,
  deleteCategory,
  listCategories,
  setCategoryTranslation,
  updateCategory,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listCategories: vi.fn(),
  setCategoryTranslation: vi.fn(),
  updateCategory: vi.fn(),
}));

const mCreate = vi.mocked(createCategory);
const mDelete = vi.mocked(deleteCategory);
const mList = vi.mocked(listCategories);
const mSetTr = vi.mocked(setCategoryTranslation);
const mUpdate = vi.mocked(updateCategory);

function cat(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    parent_id: null,
    position: 0,
    is_active: true,
    translations: [
      {
        lang: 'ru',
        name: 'Корень',
        slug: 'root',
        seo_title: 'st',
        seo_description: 'sd',
      },
      { lang: 'ro', name: 'Radacina', slug: 'radacina' },
    ],
    ...over,
  } as never;
}

// A parent (id 1) + child (id 2) + a second root (id 3) to exercise tree depth/order.
function forest() {
  return [
    cat({
      id: 3,
      position: 5,
      translations: [{ lang: 'ru', name: 'Второй', slug: 'vtoroj' }],
    }),
    cat({ id: 1, position: 1 }),
    cat({
      id: 2,
      parent_id: 1,
      position: 0,
      is_active: false,
      translations: [{ lang: 'ru', name: 'Ребёнок', slug: 'child' }],
    }),
  ] as never[];
}

let confirmValue = true;

beforeEach(() => {
  vi.clearAllMocks();
  confirmValue = true;
  window.confirm = vi.fn(() => confirmValue);
  mList.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CategoryTree — load states', () => {
  it('shows loading before the list resolves', () => {
    mList.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(CategoryTree);
    expect(w.text()).toContain('Загрузка');
  });

  it('shows the empty state when there are no categories', async () => {
    const w = mount(CategoryTree);
    await flushPromises();
    expect(w.text()).toContain('Категорий пока нет');
  });

  it('shows an error message when loading fails', async () => {
    mList.mockRejectedValue(new Error('load boom'));
    const w = mount(CategoryTree);
    await flushPromises();
    expect(w.text()).toContain('load boom');
  });

  it('falls back to a generic message on a non-Error load failure', async () => {
    mList.mockRejectedValue('weird');
    const w = mount(CategoryTree);
    await flushPromises();
    expect(w.text()).toContain('Не удалось загрузить категории');
  });

  it('renders the tree depth-first with an inactive badge and parent order', async () => {
    mList.mockResolvedValue(forest());
    const w = mount(CategoryTree);
    await flushPromises();
    const rows = w.findAll('ul > li');
    // order: root #1 (pos1), child #2, root #3 (pos5)
    expect(rows[0].text()).toContain('Корень');
    expect(rows[1].text()).toContain('Ребёнок');
    expect(rows[1].text()).toContain('неактивна');
    expect(rows[2].text()).toContain('Второй');
  });
});

describe('CategoryTree — create form', () => {
  it('opens the create form with root parent options and resets fields', async () => {
    mList.mockResolvedValue([cat()]);
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click'); // "Добавить категорию"
    await nextTick();
    expect(w.text()).toContain('Новая категория');
    // parent select: "— корень —" + 1 existing category option
    const opts = w.findAll('select option');
    expect(opts.length).toBe(2);
    expect(opts[1].text()).toContain('Корень');
  });

  it('validates a missing name and switches to the offending tab', async () => {
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click');
    await nextTick();
    const submit = w.findAll('button').find((b) => b.text() === 'Создать');
    await submit!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Укажите название для русского');
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('validates a bad slug', async () => {
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click');
    await nextTick();
    // Both language blocks render (v-show), so text inputs are [ruName, ruSlug, roName, roSlug].
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('Имя'); // ru name
    await inputs[1].setValue('A'); // ru slug too short/uppercase
    const submit = w.findAll('button').find((b) => b.text() === 'Создать');
    await submit!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Некорректный slug');
  });

  it('validates the ro tab and switches to it when ru is valid but ro is not', async () => {
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click');
    await nextTick();
    // ru valid, ro left empty
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('Имя');
    await inputs[1].setValue('imya');
    // switch to ro tab (validation should redirect here anyway)
    const roTab = w.findAll('button').find((b) => b.text() === 'Румынский');
    await roTab!.trigger('click');
    await nextTick();
    const submit = w.findAll('button').find((b) => b.text() === 'Создать');
    await submit!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('румынского');
  });

  it('creates a category with both languages and reloads', async () => {
    mCreate.mockResolvedValue(cat());
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click');
    await nextTick();
    // Inputs are [ruName, ruSlug, roName, roSlug]; fill both languages directly.
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('РуИмя');
    await inputs[1].setValue('ru-slug');
    await inputs[2].setValue('RoNume');
    await inputs[3].setValue('ro-slug');
    // toggle is_active checkbox off to exercise the binding
    const activeCb = w.find('input[type="checkbox"]');
    await activeCb.setValue(false);
    mList.mockClear();
    const submit = w.findAll('button').find((b) => b.text() === 'Создать');
    await submit!.trigger('click');
    await flushPromises();
    expect(mCreate).toHaveBeenCalledTimes(1);
    const body = mCreate.mock.calls[0][0];
    expect(body.parent_id).toBeNull();
    expect(body.is_active).toBe(false);
    expect(body.translations).toEqual([
      expect.objectContaining({ lang: 'ru', name: 'РуИмя', slug: 'ru-slug' }),
      expect.objectContaining({ lang: 'ro', name: 'RoNume', slug: 'ro-slug' }),
    ]);
    expect(mList).toHaveBeenCalled(); // reload
    expect(w.text()).not.toContain('Новая категория'); // form closed
  });

  it('creates a child category under a selected parent', async () => {
    mList.mockResolvedValue([cat()]); // existing category id 1 as a parent option
    mCreate.mockResolvedValue(cat({ id: 2, parent_id: 1 }));
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click'); // open create
    await nextTick();
    // pick the parent (option value 1) — exercises the parent_id select binding
    await w.find('select').setValue(1);
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('Дитя');
    await inputs[1].setValue('ditya');
    await inputs[2].setValue('Copil');
    await inputs[3].setValue('copil');
    const submit = w.findAll('button').find((b) => b.text() === 'Создать');
    await submit!.trigger('click');
    await flushPromises();
    expect(mCreate).toHaveBeenCalledTimes(1);
    // A parent was selected, so parent_id is no longer null (the select bound id 1).
    expect(mCreate.mock.calls[0][0].parent_id).not.toBeNull();
  });

  it('surfaces an API error on create', async () => {
    mCreate.mockRejectedValue(new Error('dup slug'));
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click');
    await nextTick();
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('РуИмя');
    await inputs[1].setValue('ru-slug');
    await inputs[2].setValue('RoNume');
    await inputs[3].setValue('ro-slug');
    const submit = w.findAll('button').find((b) => b.text() === 'Создать');
    await submit!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('dup slug');
  });

  it('closes the create form via the header "Закрыть" button', async () => {
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click'); // open
    await nextTick();
    const close = w.findAll('button').find((b) => b.text() === 'Закрыть');
    await close!.trigger('click');
    await nextTick();
    expect(w.text()).not.toContain('Новая категория');
  });

  it('closes the create form via the footer "Отмена" button', async () => {
    const w = mount(CategoryTree);
    await flushPromises();
    await w.find('button').trigger('click');
    await nextTick();
    const cancel = w.findAll('button').find((b) => b.text() === 'Отмена');
    await cancel!.trigger('click');
    await nextTick();
    expect(w.text()).not.toContain('Новая категория');
  });
});

describe('CategoryTree — row actions', () => {
  it('toggles a category active flag and reloads', async () => {
    mList.mockResolvedValue([cat()]);
    mUpdate.mockResolvedValue(cat({ is_active: false }));
    const w = mount(CategoryTree);
    await flushPromises();
    mList.mockClear();
    // the row-level "активна" checkbox
    const rowCb = w.find('ul input[type="checkbox"]');
    await rowCb.trigger('change');
    await flushPromises();
    expect(mUpdate).toHaveBeenCalledWith(1, { is_active: false });
    expect(mList).toHaveBeenCalled();
  });

  it('shows a row error when toggle fails', async () => {
    mList.mockResolvedValue([cat()]);
    mUpdate.mockRejectedValue(new Error('toggle boom'));
    const w = mount(CategoryTree);
    await flushPromises();
    const rowCb = w.find('ul input[type="checkbox"]');
    await rowCb.trigger('change');
    await flushPromises();
    expect(w.text()).toContain('toggle boom');
  });

  it('deletes a category after confirm and reloads', async () => {
    mList.mockResolvedValue([cat()]);
    mDelete.mockResolvedValue(undefined);
    confirmValue = true;
    const w = mount(CategoryTree);
    await flushPromises();
    mList.mockClear();
    const delBtn = w.findAll('button').find((b) => b.text() === 'Удалить');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(mDelete).toHaveBeenCalledWith(1);
    expect(mList).toHaveBeenCalled();
  });

  it('skips delete when confirm is cancelled', async () => {
    mList.mockResolvedValue([cat()]);
    confirmValue = false;
    const w = mount(CategoryTree);
    await flushPromises();
    const delBtn = w.findAll('button').find((b) => b.text() === 'Удалить');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(mDelete).not.toHaveBeenCalled();
  });

  it('closes an open edit panel when its category is deleted', async () => {
    mList.mockResolvedValue([cat()]);
    mDelete.mockResolvedValue(undefined);
    confirmValue = true;
    const w = mount(CategoryTree);
    await flushPromises();
    // open edit panel first (click the name button)
    const nameBtn = w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn!.trigger('click');
    await nextTick();
    expect(w.text()).toContain('SEO Title');
    const delBtn = w.findAll('button').find((b) => b.text() === 'Удалить');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(mDelete).toHaveBeenCalledWith(1);
  });

  it('shows a row error when delete fails', async () => {
    mList.mockResolvedValue([cat()]);
    mDelete.mockRejectedValue(new Error('has children'));
    confirmValue = true;
    const w = mount(CategoryTree);
    await flushPromises();
    const delBtn = w.findAll('button').find((b) => b.text() === 'Удалить');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('has children');
  });
});

describe('CategoryTree — edit panel', () => {
  it('opens the edit panel prefilled and toggles closed on second click', async () => {
    mList.mockResolvedValue([cat()]);
    const w = mount(CategoryTree);
    await flushPromises();
    const nameBtn = () =>
      w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn()!.trigger('click');
    await nextTick();
    // ru name prefilled
    const editInputs = w.findAll('.mt-3.rounded-xl input[type="text"]');
    expect((editInputs[0].element as HTMLInputElement).value).toBe('Корень');
    // second click closes
    await nameBtn()!.trigger('click');
    await nextTick();
    expect(w.text()).not.toContain('SEO Title');
  });

  it('validates the edit draft before saving', async () => {
    mList.mockResolvedValue([cat()]);
    const w = mount(CategoryTree);
    await flushPromises();
    const nameBtn = w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn!.trigger('click');
    await nextTick();
    // clear the name to make it invalid
    const editInputs = w.findAll('.mt-3.rounded-xl input[type="text"]');
    await editInputs[0].setValue('');
    const saveBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Сохранить русский');
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Укажите название');
    expect(mSetTr).not.toHaveBeenCalled();
  });

  it('edits the slug + seo fields and sends them trimmed', async () => {
    // Category whose ru translation is missing seo fields -> draftFrom nullish fallbacks.
    mList.mockResolvedValue([
      cat({ translations: [{ lang: 'ru', name: 'Корень', slug: 'root' }] }),
    ]);
    mSetTr.mockResolvedValue(undefined);
    const w = mount(CategoryTree);
    await flushPromises();
    const nameBtn = w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn!.trigger('click');
    await nextTick();
    // Edit-panel inputs (ru block): [name, slug, seo_title]; textarea = seo_description.
    const editInputs = w.findAll('.mt-3.rounded-xl input[type="text"]');
    await editInputs[1].setValue(' new-slug '); // slug (line 494)
    await editInputs[2].setValue('Заголовок'); // seo_title (line 505)
    const areas = w.findAll('.mt-3.rounded-xl textarea');
    await areas[0].setValue('Мета'); // seo_description (line 515)
    const saveBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Сохранить русский');
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mSetTr).toHaveBeenCalledWith(1, {
      lang: 'ru',
      name: 'Корень',
      slug: 'new-slug',
      seo_title: 'Заголовок',
      seo_description: 'Мета',
    });
  });

  it('saves a translation and shows the ru saved message', async () => {
    mList.mockResolvedValue([cat()]);
    mSetTr.mockResolvedValue(undefined);
    const w = mount(CategoryTree);
    await flushPromises();
    const nameBtn = w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn!.trigger('click');
    await nextTick();
    mList.mockClear();
    const saveBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Сохранить русский');
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mSetTr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lang: 'ru', name: 'Корень', slug: 'root' }),
    );
    expect(w.text()).toContain('Русский перевод сохранён');
    expect(mList).toHaveBeenCalled();
  });

  it('saves the ro translation with its own saved message', async () => {
    mList.mockResolvedValue([cat()]);
    mSetTr.mockResolvedValue(undefined);
    const w = mount(CategoryTree);
    await flushPromises();
    const nameBtn = w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn!.trigger('click');
    await nextTick();
    // switch edit tab to ro
    const roTab = w
      .findAll('.mt-3.rounded-xl button')
      .find((b) => b.text() === 'Румынский');
    await roTab!.trigger('click');
    await nextTick();
    const saveBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Сохранить румынский');
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mSetTr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lang: 'ro' }),
    );
    expect(w.text()).toContain('Румынский перевод сохранён');
  });

  it('surfaces an API error on translation save', async () => {
    mList.mockResolvedValue([cat()]);
    mSetTr.mockRejectedValue(new Error('slug taken'));
    const w = mount(CategoryTree);
    await flushPromises();
    const nameBtn = w.findAll('ul button').find((b) => b.text() === 'Корень');
    await nameBtn!.trigger('click');
    await nextTick();
    const saveBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Сохранить русский');
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('slug taken');
  });

  it('falls back to id-based name when a category has no translations', async () => {
    mList.mockResolvedValue([cat({ id: 9, translations: [] })]);
    const w = mount(CategoryTree);
    await flushPromises();
    expect(w.text()).toContain('#9');
  });

  it('uses the first translation name when ru is absent', async () => {
    mList.mockResolvedValue([
      cat({
        id: 4,
        translations: [{ lang: 'ro', name: 'DoarRo', slug: 'doar-ro' }],
      }),
    ]);
    const w = mount(CategoryTree);
    await flushPromises();
    expect(w.text()).toContain('DoarRo');
  });
});
