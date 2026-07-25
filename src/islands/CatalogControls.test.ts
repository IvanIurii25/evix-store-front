import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listProducts = vi.fn();
vi.mock('../api/catalog', () => ({
  listProducts: (...a: unknown[]) => listProducts(...a),
}));

import CatalogControls from './CatalogControls.vue';
import type { Lang } from '../lib/i18n';
import type { ProductCard, FacetsResponse } from '../api/catalog';

function makeProduct(id: number): ProductCard {
  return {
    product_id: id,
    slug: `p-${id}`,
    name: `Товар ${id}`,
    price: '100',
    old_price: null,
    main_image_url: null,
    in_stock: true,
    badge: null,
  };
}

const FACETS: FacetsResponse = {
  price_min: null,
  price_max: null,
  attributes: [
    {
      attribute_id: 10,
      code: 'color',
      name: 'Цвет',
      values: [
        { value_id: 100, value: 'Красный', count: 3 },
        { value_id: 101, value: 'Синий', count: 5 },
      ],
    },
  ],
};

const replaceState = vi.fn();

interface CatalogProps {
  categorySlug: string;
  lang: Lang;
  initialProducts: ProductCard[];
  initialCursor: string | null;
  facets: FacetsResponse;
}

// `mount`'s props slot is the component props intersected with @vue/test-utils'
// VNodeProps/HTMLAttributes (the known Vue + TS friction). Derive that exact
// slot type from `mount` so we validate the fixture against the real prop types
// via `CatalogProps`, then widen the return once — no scattered call-site casts.
type MountProps = NonNullable<
  NonNullable<Parameters<typeof mount<typeof CatalogControls>>[1]>['props']
>;

function baseProps(overrides: Partial<CatalogProps> = {}): MountProps {
  const props: CatalogProps = {
    categorySlug: 'phones',
    lang: 'ru',
    initialProducts: [makeProduct(1), makeProduct(2)],
    initialCursor: null,
    facets: FACETS,
    ...overrides,
  };
  return props as unknown as MountProps;
}

function stubLocation(search = '', pathname = '/ru/c/phones') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { search, pathname, href: `http://localhost${pathname}${search}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubLocation('');
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { replaceState },
  });
});

describe('CatalogControls', () => {
  it('renders initial products and the facet checkboxes', async () => {
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    expect(wrapper.text()).toContain('2 товара');
    expect(wrapper.text()).toContain('Цвет');
    expect(wrapper.text()).toContain('Красный');
    // No filters active on a clean URL → no reload.
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('shows the empty message when there are no products and no facet section without attributes', async () => {
    const wrapper = mount(CatalogControls, {
      props: baseProps({
        initialProducts: [],
        facets: { price_min: null, price_max: null, attributes: [] },
      }),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('В этой категории пока нет товаров.');
  });

  it('applies price filter via the button: calls listProducts and writes the URL', async () => {
    listProducts.mockResolvedValue({
      data: [makeProduct(3)],
      next_cursor: null,
    });
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    const numInputs = wrapper.findAll('input[type="number"]');
    await numInputs[0].setValue('50'); // priceMin
    await numInputs[1].setValue('500'); // priceMax
    const applyBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Применить')!;
    await applyBtn.trigger('click');
    await flushPromises();

    expect(listProducts).toHaveBeenCalledWith('phones', 'ru', {
      sort: 'newest',
      priceMin: 50,
      priceMax: 500,
      valueIds: undefined,
    });
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '?price_min=50&price_max=500',
    );
    // Product list replaced with the reload result.
    expect(wrapper.text()).toContain('Товар 3');
    expect(wrapper.text()).toContain('1 товар');
  });

  it('toggles a facet value on and off, reloading each time', async () => {
    listProducts.mockResolvedValue({
      data: [makeProduct(9)],
      next_cursor: null,
    });
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.trigger('change'); // select 100
    await flushPromises();
    expect(listProducts).toHaveBeenLastCalledWith('phones', 'ru', {
      sort: 'newest',
      priceMin: undefined,
      priceMax: undefined,
      valueIds: [100],
    });

    await checkbox.trigger('change'); // deselect 100
    await flushPromises();
    expect(listProducts).toHaveBeenLastCalledWith('phones', 'ru', {
      sort: 'newest',
      priceMin: undefined,
      priceMax: undefined,
      valueIds: undefined,
    });
  });

  it('changing sort reloads and encodes non-default sort in the URL', async () => {
    listProducts.mockResolvedValue({
      data: [makeProduct(4)],
      next_cursor: null,
    });
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    const select = wrapper.find('select');
    await select.setValue('price_asc');
    await flushPromises();

    expect(listProducts).toHaveBeenCalledWith('phones', 'ru', {
      sort: 'price_asc',
      priceMin: undefined,
      priceMax: undefined,
      valueIds: undefined,
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', '?sort=price_asc');
  });

  it('resets the URL to the pathname when no filters are active', async () => {
    listProducts.mockResolvedValue({ data: [], next_cursor: null });
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    // Apply with empty filters → writeUrl produces empty qs → pathname.
    const applyBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Применить')!;
    await applyBtn.trigger('click');
    await flushPromises();

    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/ru/c/phones');
  });

  it('shows the "load more" button when a cursor exists and appends the next page', async () => {
    listProducts.mockResolvedValue({
      data: [makeProduct(5)],
      next_cursor: null,
    });
    const wrapper = mount(CatalogControls, {
      props: baseProps({ initialCursor: 'cur-1' }),
    });
    await flushPromises();

    const more = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Показать ещё')!;
    expect(more).toBeTruthy();
    await more.trigger('click');
    await flushPromises();

    expect(listProducts).toHaveBeenCalledWith('phones', 'ru', {
      sort: 'newest',
      priceMin: undefined,
      priceMax: undefined,
      valueIds: undefined,
      cursor: 'cur-1',
    });
    // Appended: original 2 + 1 more = 3.
    expect(wrapper.text()).toContain('3 товара');
    // Cursor exhausted → button gone.
    expect(
      wrapper.findAll('button').find((b) => b.text() === 'Показать ещё'),
    ).toBeUndefined();
  });

  it('loadMore is a no-op when there is no cursor', async () => {
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();
    // No load-more button rendered without a cursor.
    expect(
      wrapper.findAll('button').find((b) => b.text()?.includes('Показать')),
    ).toBeUndefined();
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('restores filter state from a shared URL on mount and reloads', async () => {
    stubLocation(
      '?sort=price_desc&price_min=10&price_max=90&value_ids=100&value_ids=101',
    );
    listProducts.mockResolvedValue({
      data: [makeProduct(6)],
      next_cursor: 'nc',
    });
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    // onMounted detected active filters → reload with the parsed state.
    expect(listProducts).toHaveBeenCalledWith('phones', 'ru', {
      sort: 'price_desc',
      priceMin: 10,
      priceMax: 90,
      valueIds: [100, 101],
    });
    expect(wrapper.text()).toContain('Товар 6');
    // next_cursor present → load-more visible.
    expect(
      wrapper.findAll('button').find((b) => b.text() === 'Показать ещё'),
    ).toBeTruthy();
  });

  it('ignores an invalid sort value in the URL', async () => {
    stubLocation('?sort=bogus&value_ids=100');
    listProducts.mockResolvedValue({ data: [], next_cursor: null });
    mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    // Invalid sort skipped → stays 'newest'; value_ids still active so reload runs.
    expect(listProducts).toHaveBeenCalledWith('phones', 'ru', {
      sort: 'newest',
      priceMin: undefined,
      priceMax: undefined,
      valueIds: [100],
    });
  });

  it('shows an error + retry when load-more fails, then recovers', async () => {
    listProducts.mockRejectedValueOnce(new Error('boom'));
    const wrapper = mount(CatalogControls, {
      props: baseProps({ initialCursor: 'c1' }),
    });
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Показать ещё')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Не удалось загрузить товары.');
    const retryBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Повторить');
    expect(retryBtn).toBeTruthy();

    listProducts.mockResolvedValueOnce({
      data: [makeProduct(9)],
      next_cursor: null,
    });
    await retryBtn!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('Не удалось загрузить товары.');
    expect(wrapper.text()).toContain('Товар 9');
  });

  it('shows an error + retry when a filter reload fails', async () => {
    listProducts.mockRejectedValueOnce(new Error('boom'));
    const wrapper = mount(CatalogControls, { props: baseProps() });
    await flushPromises();

    await wrapper.findAll('input[type="number"]')[0].setValue('50');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Применить')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Не удалось загрузить товары.');

    listProducts.mockResolvedValueOnce({
      data: [makeProduct(9)],
      next_cursor: null,
    });
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Повторить')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Товар 9');
  });
});
