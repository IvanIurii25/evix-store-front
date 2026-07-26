import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

import ProductEditor from './ProductEditor.vue';
import {
  bindMediaToVariant,
  createProduct,
  deleteProduct,
  deleteProductMedia,
  deleteVariant,
  generateVariants,
  getProduct,
  getRestockWaiters,
  listAttributes,
  listCategories,
  reorderProductMedia,
  setProductAttributes,
  setProductTranslation,
  updateProduct,
  uploadProductMedia,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({
  bindMediaToVariant: vi.fn(),
  createProduct: vi.fn(),
  createVariant: vi.fn(),
  deleteProduct: vi.fn(),
  deleteProductMedia: vi.fn(),
  deleteVariant: vi.fn(),
  generateVariants: vi.fn(),
  getProduct: vi.fn(),
  getRestockWaiters: vi.fn(),
  listAttributes: vi.fn(),
  listCategories: vi.fn(),
  reorderProductMedia: vi.fn(),
  setProductAttributes: vi.fn(),
  setProductTranslation: vi.fn(),
  setVariationAttributes: vi.fn(),
  updateProduct: vi.fn(),
  updateVariant: vi.fn(),
  uploadProductMedia: vi.fn(),
}));

const mCreate = vi.mocked(createProduct);
const mDelete = vi.mocked(deleteProduct);
const mDeleteMedia = vi.mocked(deleteProductMedia);
const mGet = vi.mocked(getProduct);
const mWaiters = vi.mocked(getRestockWaiters);
const mListAttrs = vi.mocked(listAttributes);
const mListCats = vi.mocked(listCategories);
const mReorder = vi.mocked(reorderProductMedia);
const mSetAttrs = vi.mocked(setProductAttributes);
const mSetTr = vi.mocked(setProductTranslation);
const mUpdate = vi.mocked(updateProduct);
const mUpload = vi.mocked(uploadProductMedia);
const mGen = vi.mocked(generateVariants);
const mDelVar = vi.mocked(deleteVariant);
const mBind = vi.mocked(bindMediaToVariant);

function cat(id: number, name = `Cat ${id}`) {
  return {
    id,
    parent_id: null,
    position: 0,
    is_active: true,
    translations: [{ lang: 'ru', name, slug: `cat-${id}` }],
  } as never;
}

function media(id: number, position: number) {
  return { id, url: `/m/${id}.jpg`, position } as never;
}

function attr(id: number, code: string, values: [number, string][]) {
  return {
    id,
    code,
    translations: [{ lang: 'ru', name: `Attr ${id}` }],
    values: values.map(([vid, text]) => ({
      id: vid,
      attribute_id: id,
      translations: [{ lang: 'ru', value: text }],
    })),
  } as never;
}

function product(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    category_id: 1,
    code: 'SKU-1',
    price: '100',
    old_price: '150',
    qty: 5,
    is_active: true,
    media: [media(11, 0), media(12, 1)],
    translations: [
      {
        lang: 'ru',
        name: 'Товар',
        slug: 'tovar',
        description: 'опис',
        seo_title: 'seo',
        seo_description: 'seod',
      },
    ],
    ...over,
  } as never;
}

let originalLocation: Location;
function locationHref() {
  return (window.location as unknown as { href: string }).href;
}

// The save button is the first "Сохранить/Создать товар" button in the footer.
function saveButton(w: ReturnType<typeof mount>) {
  return w
    .findAll('button')
    .find(
      (b) =>
        /Сохранить|Создать товар|Сохраняем/.test(b.text()) &&
        b.text() !== 'Удалить товар',
    )!;
}

let confirmValue = true;

beforeEach(() => {
  vi.clearAllMocks();
  confirmValue = true;
  originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { href: '' },
  });
  window.confirm = vi.fn(() => confirmValue);
  mListCats.mockResolvedValue([cat(1), cat(2)]);
  mListAttrs.mockResolvedValue([]);
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe('ProductEditor — create mode', () => {
  it('shows loading, then the create form with categories', async () => {
    mListCats.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(ProductEditor, { props: {} });
    expect(w.text()).toContain('Загрузка');
  });

  it('populates the category select and hides media section in create mode', async () => {
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    const opts = w.findAll('select option');
    // null placeholder + 2 categories
    expect(opts.length).toBe(3);
    expect(w.text()).toContain('Cat 1');
    expect(w.text()).not.toContain('Изображения');
    expect(w.text()).toContain('Создать товар');
    expect(mGet).not.toHaveBeenCalled();
  });

  it('reports an error when category loading fails', async () => {
    mListCats.mockRejectedValue(new Error('boom cats'));
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    expect(w.text()).toContain('boom cats');
  });

  it('falls back to a generic message on a non-Error load failure', async () => {
    mListCats.mockRejectedValue('weird');
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    expect(w.text()).toContain('Ошибка загрузки');
  });

  it('validates: missing category', async () => {
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Выберите категорию');
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('validates: missing code', async () => {
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Укажите код товара');
  });

  it('validates: bad price', async () => {
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('CODE'); // code
    await inputs[1].setValue('abc'); // price
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Укажите корректную цену');
  });

  it('validates: bad old price', async () => {
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    const inputs = w.findAll('input[type="text"]');
    await inputs[0].setValue('CODE');
    await inputs[1].setValue('100');
    await inputs[2].setValue('nope'); // old price
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Старая цена указана неверно');
  });

  it('creates a product with trimmed structural + translation payload and redirects', async () => {
    mCreate.mockResolvedValue(product({ id: 99 }));
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    const textInputs = w.findAll('input[type="text"]');
    await textInputs[0].setValue('  CODE-1  '); // code
    await textInputs[1].setValue(' 100 '); // price
    await textInputs[2].setValue(' 200 '); // old price
    // money hint renders for a filled price
    expect(w.text()).toContain('L');
    // translation name (ru tab active) — name is first text input inside translations
    const nameInput = w.find('section:nth-of-type(2) input[type="text"]');
    await nameInput.setValue('Имя');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(mCreate).toHaveBeenCalledTimes(1);
    const arg = mCreate.mock.calls[0][0];
    expect(arg.code).toBe('CODE-1');
    expect(arg.price).toBe('100');
    expect(arg.old_price).toBe('200');
    expect(arg.category_id).toBe(1);
    expect(arg.translations).toEqual([
      expect.objectContaining({ lang: 'ru', name: 'Имя' }),
    ]);
    expect(locationHref()).toBe('/admin/products/99');
  });

  it('sends old_price null when blank on create', async () => {
    mCreate.mockResolvedValue(product({ id: 5 }));
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('2');
    const textInputs = w.findAll('input[type="text"]');
    await textInputs[0].setValue('X');
    await textInputs[1].setValue('10');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(mCreate.mock.calls[0][0].old_price).toBeNull();
  });

  it('surfaces an API error on create', async () => {
    mCreate.mockRejectedValue(new Error('dup code'));
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    const textInputs = w.findAll('input[type="text"]');
    await textInputs[0].setValue('X');
    await textInputs[1].setValue('10');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('dup code');
  });

  it('falls back to a generic message on a non-Error create failure', async () => {
    mCreate.mockRejectedValue('nope');
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    const textInputs = w.findAll('input[type="text"]');
    await textInputs[0].setValue('X');
    await textInputs[1].setValue('10');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Ошибка сохранения');
  });

  it('writes through every structural + translation field binding', async () => {
    mCreate.mockResolvedValue(product({ id: 3 }));
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    await w.find('select').setValue('1');
    // structural: code, price, old_price
    const textInputs = w.findAll('input[type="text"]');
    await textInputs[0].setValue('SKU'); // code
    await textInputs[1].setValue('50'); // price
    await textInputs[2].setValue('80'); // old price (line 520 binding)
    // qty number input (line 340 binding)
    await w.find('input[type="number"]').setValue('9');
    // is_active checkbox (line 380 binding)
    await w.find('input[type="checkbox"]').setValue(true);
    // translation section fields: name, slug, description, seo_title, seo_description
    const trSection = w.findAll('section')[1];
    const trTexts = trSection.findAll('input[type="text"]');
    await trTexts[0].setValue('Имя'); // name
    await trTexts[1].setValue('imya'); // slug
    const areas = trSection.findAll('textarea');
    await areas[0].setValue('Описание'); // description (line 457)
    await trTexts[2].setValue('SEO'); // seo_title (line 466)
    await areas[1].setValue('SEO descr'); // seo_description (line 477)
    await saveButton(w).trigger('click');
    await flushPromises();
    const body = mCreate.mock.calls[0][0];
    expect(body.qty).toBe(9);
    expect(body.is_active).toBe(true);
    expect(body.old_price).toBe('80');
    expect(body.translations?.[0]).toEqual(
      expect.objectContaining({
        name: 'Имя',
        slug: 'imya',
        description: 'Описание',
        seo_title: 'SEO',
        seo_description: 'SEO descr',
      }),
    );
  });

  it('switches translation tabs and flags an invalid slug', async () => {
    const w = mount(ProductEditor, { props: {} });
    await flushPromises();
    // switch to ro tab
    const tabButtons = w
      .findAll('button')
      .filter((b) => ['ru', 'ro'].includes(b.text().toLowerCase()));
    expect(tabButtons.length).toBe(2);
    await tabButtons[1].trigger('click');
    await nextTick();
    // enter an invalid slug in the slug input (2nd text input in translations)
    const trSection = w.findAll('section')[1];
    const slugInput = trSection.findAll('input[type="text"]')[1];
    await slugInput.setValue('BAD SLUG');
    await nextTick();
    expect(trSection.text()).toContain('мин. 2');
    expect(trSection.find('.text-danger').exists()).toBe(true);
    // valid slug clears the danger styling text
    await slugInput.setValue('good-slug');
    await nextTick();
    expect(trSection.find('.text-danger').exists()).toBe(false);
  });
});

describe('ProductEditor — edit mode', () => {
  it('loads the product, fills fields, sorts media, and shows waiters hint', async () => {
    mGet.mockResolvedValue(product({ media: [media(12, 5), media(11, 1)] }));
    mWaiters.mockResolvedValue(3);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    expect(mGet).toHaveBeenCalledWith(7);
    expect(w.text()).toContain('Изображения');
    expect(w.text()).toContain('ожидают поступления');
    // sorted by position: media 11 (pos 1) first
    const imgs = w.findAll('img');
    expect(imgs[0].attributes('src')).toContain('/m/11');
    expect(w.text()).toContain('Сохранить');
    expect(w.text()).toContain('Удалить товар');
  });

  it('labels a category with no ru translation by its id and blanks a missing product translation', async () => {
    // Category #2 has no ru translation -> categoryLabel falls back to "#2".
    mListCats.mockResolvedValue([
      cat(1),
      {
        id: 2,
        parent_id: null,
        position: 0,
        is_active: true,
        translations: [],
      } as never,
    ]);
    // Product carries only a ro translation -> ru fillFromProduct falls back to blank.
    mGet.mockResolvedValue(
      product({
        translations: [{ lang: 'ro', name: 'Nume', slug: 'nume' }],
      }),
    );
    mWaiters.mockResolvedValue(0);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const opts = w.findAll('select option');
    expect(opts.some((o) => o.text() === '#2')).toBe(true);
    // ru tab active by default: name input should be blank (no ru translation).
    const nameInput = w.find('section:nth-of-type(2) input[type="text"]');
    expect((nameInput.element as HTMLInputElement).value).toBe('');
  });

  it('saves a ro translation when the ro name is filled', async () => {
    mGet.mockResolvedValue(
      product({
        translations: [
          { lang: 'ru', name: 'Товар', slug: 'tovar' },
          { lang: 'ro', name: 'Produs', slug: 'produs' },
        ],
      }),
    );
    mWaiters.mockResolvedValue(0);
    mUpdate.mockResolvedValue(product());
    mSetTr.mockResolvedValue(undefined);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    await saveButton(w).trigger('click');
    await flushPromises();
    // both ru and ro translations have names -> both persisted
    expect(mSetTr).toHaveBeenCalledTimes(2);
    expect(mSetTr).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ lang: 'ro', name: 'Produs' }),
    );
  });

  it('shows a not-found panel when the product load throws', async () => {
    mGet.mockRejectedValue(new Error('404'));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Товар не найден');
    expect(mWaiters).not.toHaveBeenCalled();
  });

  it('renders "no images" copy when media is empty', async () => {
    mGet.mockResolvedValue(product({ media: [] }));
    mWaiters.mockResolvedValue(0);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Изображений пока нет');
    expect(w.text()).not.toContain('ожидают поступления');
  });

  it('saves structural + only named translations, reloads, and shows success', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mUpdate.mockResolvedValue(product());
    mSetTr.mockResolvedValue(undefined);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    mGet.mockClear();
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(mUpdate).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ code: 'SKU-1' }),
    );
    // ru has a name -> translation saved; ro empty -> skipped
    expect(mSetTr).toHaveBeenCalledTimes(1);
    expect(mSetTr).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ lang: 'ru' }),
    );
    expect(mGet).toHaveBeenCalledWith(7); // reload
    expect(w.text()).toContain('Товар сохранён');
  });

  it('surfaces an API error on update', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mUpdate.mockRejectedValue(new Error('save failed'));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('save failed');
  });

  it('uploads a media file, then reloads', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mUpload.mockResolvedValue(media(20, 2));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    mGet.mockClear();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const fileInput = w.find('input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [file],
    });
    await fileInput.trigger('change');
    await flushPromises();
    expect(mUpload).toHaveBeenCalledWith(7, file);
    expect(mGet).toHaveBeenCalledWith(7);
  });

  it('ignores an upload change with no file', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const fileInput = w.find('input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [],
    });
    await fileInput.trigger('change');
    await flushPromises();
    expect(mUpload).not.toHaveBeenCalled();
  });

  it('shows an error when upload fails', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mUpload.mockRejectedValue(new Error('too big'));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const fileInput = w.find('input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [file],
    });
    await fileInput.trigger('change');
    await flushPromises();
    expect(w.text()).toContain('too big');
  });

  it('removes a media item and reloads', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mDeleteMedia.mockResolvedValue(undefined);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    mGet.mockClear();
    // the "×" delete button in each media tile
    const delBtn = w
      .findAll('button')
      .find((b) => b.attributes('title') === 'Удалить');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(mDeleteMedia).toHaveBeenCalledWith(7, 11);
    expect(mGet).toHaveBeenCalledWith(7);
  });

  it('shows an error when media delete fails', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mDeleteMedia.mockRejectedValue(new Error('nope del'));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const delBtn = w
      .findAll('button')
      .find((b) => b.attributes('title') === 'Удалить');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('nope del');
  });

  it('reorders media down and re-sorts by returned position', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mReorder.mockResolvedValue([media(12, 0), media(11, 1)]);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const downBtn = w
      .findAll('button')
      .find((b) => b.attributes('title') === 'Вправо');
    await downBtn!.trigger('click');
    await flushPromises();
    // first tile's ids swapped: [12, 11]
    expect(mReorder).toHaveBeenCalledWith(7, [12, 11]);
    const imgs = w.findAll('img');
    expect(imgs[0].attributes('src')).toContain('/m/12');
  });

  it('reorders media up on the second item', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mReorder.mockResolvedValue([media(12, 0), media(11, 1)]);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const upBtns = w
      .findAll('button')
      .filter((b) => b.attributes('title') === 'Влево');
    // second tile's up button moves item index 1 -> 0
    await upBtns[1].trigger('click');
    await flushPromises();
    expect(mReorder).toHaveBeenCalledWith(7, [12, 11]);
  });

  it('does not reorder past the boundary (up on first item)', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const upBtns = w
      .findAll('button')
      .filter((b) => b.attributes('title') === 'Влево');
    // first up button is disabled; click it anyway -> guard returns
    await upBtns[0].trigger('click');
    await flushPromises();
    expect(mReorder).not.toHaveBeenCalled();
  });

  it('shows an error when reorder fails', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mReorder.mockRejectedValue(new Error('reorder boom'));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const downBtn = w
      .findAll('button')
      .find((b) => b.attributes('title') === 'Вправо');
    await downBtn!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('reorder boom');
  });

  it('deletes the product after confirm and redirects', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mDelete.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const delProductBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Удалить товар');
    await delProductBtn!.trigger('click');
    await flushPromises();
    expect(mDelete).toHaveBeenCalledWith(7);
    expect(locationHref()).toBe('/admin/products');
  });

  it('does not delete the product when confirm is cancelled', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const delProductBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Удалить товар');
    await delProductBtn!.trigger('click');
    await flushPromises();
    expect(mDelete).not.toHaveBeenCalled();
  });

  it('shows an error and clears saving when product delete fails', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mDelete.mockRejectedValue(new Error('has orders'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const delProductBtn = w
      .findAll('button')
      .find((b) => b.text() === 'Удалить товар');
    await delProductBtn!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('has orders');
  });

  it('renders the attributes section with values and preselects value_ids', async () => {
    mGet.mockResolvedValue(product({ value_ids: [101] }));
    mWaiters.mockResolvedValue(0);
    mListAttrs.mockResolvedValue([
      attr(1, 'color', [
        [101, 'Красный'],
        [102, 'Синий'],
      ]),
    ]);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Атрибуты');
    expect(w.text()).toContain('Красный');
    expect(w.text()).toContain('Синий');
    const attrSection = w
      .findAll('section')
      .find((s) => s.text().includes('Красный'))!;
    const boxes = attrSection.findAll('input[type="checkbox"]');
    // value 101 preselected, 102 not
    expect((boxes[0].element as HTMLInputElement).checked).toBe(true);
    expect((boxes[1].element as HTMLInputElement).checked).toBe(false);
  });

  it('shows an empty state when there are no attributes', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mListAttrs.mockResolvedValue([]);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    expect(w.text()).toContain('Атрибутов пока нет');
  });

  it('still loads the editor when attribute listing fails', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mListAttrs.mockRejectedValue(new Error('attrs down'));
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    // editor renders (not the not-found panel), attributes empty state shown
    expect(w.text()).not.toContain('Товар не найден');
    expect(w.text()).toContain('Атрибутов пока нет');
  });

  it('toggles a value checkbox and saves selected value_ids', async () => {
    mGet.mockResolvedValue(product({ value_ids: [101] }));
    mWaiters.mockResolvedValue(0);
    mUpdate.mockResolvedValue(product());
    mSetTr.mockResolvedValue(undefined);
    mSetAttrs.mockResolvedValue(product());
    mListAttrs.mockResolvedValue([
      attr(1, 'color', [
        [101, 'Красный'],
        [102, 'Синий'],
      ]),
    ]);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();
    const attrSection = w
      .findAll('section')
      .find((s) => s.text().includes('Красный'))!;
    const boxes = attrSection.findAll('input[type="checkbox"]');
    // toggle 101 off, 102 on
    await boxes[0].trigger('change');
    await boxes[1].trigger('change');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(mSetAttrs).toHaveBeenCalledTimes(1);
    expect(mSetAttrs).toHaveBeenCalledWith(7, [102]);
  });

  it('renders variant combinations and wires generate + delete', async () => {
    mGet.mockResolvedValue(
      product({
        has_variants: true,
        value_ids: [101, 102],
        variation_attribute_ids: [1],
        variants: [
          {
            id: 51,
            product_id: 7,
            code: 'V-1',
            price: '179',
            old_price: null,
            qty: 5,
            position: 0,
            is_active: true,
            value_ids: [101],
            image_media_id: null,
          },
          {
            id: 52,
            product_id: 7,
            code: 'V-2',
            price: '249',
            old_price: null,
            qty: 0,
            position: 1,
            is_active: true,
            value_ids: [102],
            image_media_id: null,
          },
        ],
      }),
    );
    mWaiters.mockResolvedValue(0);
    mListAttrs.mockResolvedValue([
      attr(1, 'color', [
        [101, 'Красный'],
        [102, 'Синий'],
      ]),
    ]);
    mGen.mockResolvedValue([]);
    mDelVar.mockResolvedValue(undefined);

    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();

    // Both combinations rendered with their localized option labels.
    expect(w.text()).toContain('Комбинации (2)');
    expect(w.text()).toContain('Красный');
    expect(w.text()).toContain('Синий');

    // "Generate all" calls the API for this product.
    await w
      .findAll('button')
      .find((b) => b.text() === 'Сгенерировать все')!
      .trigger('click');
    await flushPromises();
    expect(mGen).toHaveBeenCalledWith(7);

    // The row delete (×), scoped to the variations section, removes that variant.
    const varSection = w
      .findAll('section')
      .find((s) => s.text().includes('Комбинации'))!;
    await varSection
      .findAll('button')
      .find((b) => b.text() === '×')!
      .trigger('click');
    await flushPromises();
    expect(mDelVar).toHaveBeenCalledWith(51);
  });

  it('binds an image to a variant from the media dropdown', async () => {
    mGet.mockResolvedValue(
      product({
        has_variants: true,
        variation_attribute_ids: [1],
        variants: [
          {
            id: 51,
            product_id: 7,
            code: null,
            price: '10',
            old_price: null,
            qty: 1,
            position: 0,
            is_active: true,
            value_ids: [101],
            image_media_id: null,
          },
        ],
      }),
    );
    mWaiters.mockResolvedValue(0);
    mListAttrs.mockResolvedValue([attr(1, 'color', [[101, 'Красный']])]);
    mBind.mockResolvedValue(undefined as never);

    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();

    // The per-image variant dropdown (only shown when variants exist).
    const mediaSelect = w
      .findAll('select')
      .find((s) => s.text().includes('Общая галерея'))!;
    await mediaSelect.setValue('51');
    await flushPromises();
    // media id 11 is the product()'s first image; bind it to variant 51.
    expect(mBind).toHaveBeenCalledWith(7, 11, 51);
  });

  it('renders attribute values in locale/number order, not insertion order', async () => {
    mGet.mockResolvedValue(product());
    mWaiters.mockResolvedValue(0);
    mListAttrs.mockResolvedValue([
      attr(1, 'size', [
        [201, '50'],
        [202, '5'],
        [203, '100'],
        [204, '10'],
      ]),
    ]);
    const w = mount(ProductEditor, { props: { productId: 7 } });
    await flushPromises();

    const section = w
      .findAll('section')
      .find((s) => s.text().includes('Атрибуты') && s.text().includes('100'))!;
    const nums = section
      .findAll('label')
      .map((l) => l.text().trim())
      .filter((t) => ['5', '10', '50', '100'].includes(t));
    expect(nums).toEqual(['5', '10', '50', '100']);
  });
});
