import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CannedManager from './CannedManager.vue';
import {
  listCanned,
  createCanned,
  updateCanned,
  deleteCanned,
  type CannedOut,
} from '../../api/support';

vi.mock('../../api/support', () => ({
  listCanned: vi.fn(),
  createCanned: vi.fn(),
  updateCanned: vi.fn(),
  deleteCanned: vi.fn(),
}));

const mockList = vi.mocked(listCanned);
const mockCreate = vi.mocked(createCanned);
const mockUpdate = vi.mocked(updateCanned);
const mockDelete = vi.mocked(deleteCanned);

const item = (over: Partial<CannedOut> = {}): CannedOut =>
  ({
    id: 1,
    title: 'Доставка',
    text: 'Доставка 1–2 дня',
    lang: 'ru',
    sort_order: 0,
    ...over,
  }) as CannedOut;

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
});

describe('CannedManager', () => {
  it('shows the empty state when there are no templates', async () => {
    const w = mount(CannedManager);
    await flushPromises();
    expect(w.text()).toContain('Шаблонов нет');
  });

  it('renders the loaded templates', async () => {
    mockList.mockResolvedValue([item()]);
    const w = mount(CannedManager);
    await flushPromises();
    expect(w.text()).toContain('Доставка');
    expect(w.text()).toContain('[ru]');
  });

  it('creates a template from the form', async () => {
    mockCreate.mockResolvedValue(item({ id: 2 }));
    const w = mount(CannedManager);
    await flushPromises();

    await w.find('input').setValue('Оплата');
    await w.find('textarea').setValue('При получении');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Создать')!
      .trigger('click');
    await flushPromises();

    expect(mockCreate).toHaveBeenCalledWith({
      title: 'Оплата',
      text: 'При получении',
      lang: 'ru',
      sort_order: 0,
    });
    expect(mockList).toHaveBeenCalledTimes(2); // mount + after create
  });

  it('edits an existing template', async () => {
    mockList.mockResolvedValue([item()]);
    mockUpdate.mockResolvedValue(item({ title: 'Доставка!' }));
    const w = mount(CannedManager);
    await flushPromises();

    await w
      .findAll('button')
      .find((b) => b.text() === 'Правка')!
      .trigger('click');
    // form is now populated; button switches to "Сохранить"
    await w.find('input').setValue('Доставка!');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Сохранить')!
      .trigger('click');
    await flushPromises();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: 'Доставка!' }),
    );
  });

  it('deletes a template', async () => {
    mockList.mockResolvedValue([item()]);
    mockDelete.mockResolvedValue();
    const w = mount(CannedManager);
    await flushPromises();

    await w
      .findAll('button')
      .find((b) => b.text() === 'Удалить')!
      .trigger('click');
    await flushPromises();
    expect(mockDelete).toHaveBeenCalledWith(1);
  });

  it('surfaces a load error', async () => {
    mockList.mockRejectedValue(new Error('нет доступа'));
    const w = mount(CannedManager);
    await flushPromises();
    expect(w.text()).toContain('нет доступа');
  });

  it('shows fallback messages on non-Error rejections (save & delete)', async () => {
    mockList.mockResolvedValue([item()]);
    mockCreate.mockRejectedValue('boom'); // not an Error
    const w = mount(CannedManager);
    await flushPromises();

    await w.find('input').setValue('T');
    await w.find('textarea').setValue('x');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Создать')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось сохранить');

    mockDelete.mockRejectedValue('boom');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Удалить')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось удалить');
  });
});
