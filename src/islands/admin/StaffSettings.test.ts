import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import StaffSettings from './StaffSettings.vue';
import {
  createStaff,
  listStaff,
  updateStaff,
  type StaffItem,
} from '../../api/admin';

vi.mock('../../api/admin', () => ({
  createStaff: vi.fn(),
  listStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

const mockList = vi.mocked(listStaff);
const mockCreate = vi.mocked(createStaff);
const mockUpdate = vi.mocked(updateStaff);

const staff = (over: Partial<StaffItem> = {}): StaffItem =>
  ({
    id: 1,
    email: 'a@b.md',
    phone: '+37360000000',
    is_active: true,
    is_staff: true,
    created_at: '2026-01-15T10:00:00Z',
    ...over,
  }) as StaffItem;

beforeEach(() => {
  mockList.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('StaffSettings', () => {
  it('shows a loading state before the list resolves', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(StaffSettings);
    expect(w.text()).toContain('Загрузка');
  });

  it('renders one row per staff member with phone fallback and status labels', async () => {
    mockList.mockResolvedValue([
      staff({ id: 1, email: 'active@b.md', is_active: true }),
      staff({ id: 2, email: 'blocked@b.md', phone: null, is_active: false }),
    ]);
    const w = mount(StaffSettings);
    await flushPromises();

    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('active@b.md');
    expect(rows[0].text()).toContain('Активен');
    expect(rows[1].text()).toContain('—'); // null phone fallback
    expect(rows[1].text()).toContain('Заблокирован');
  });

  it('shows the empty state when there are no staff members', async () => {
    mockList.mockResolvedValue([]);
    const w = mount(StaffSettings);
    await flushPromises();
    expect(w.text()).toContain('Сотрудников нет');
  });

  it('shows the load-error state when the list fails', async () => {
    mockList.mockRejectedValue(new Error('load failed'));
    const w = mount(StaffSettings);
    await flushPromises();
    expect(w.find('.text-danger').text()).toBe('load failed');
  });

  it('uses a fallback message for non-Error load rejections', async () => {
    mockList.mockRejectedValue('x');
    const w = mount(StaffSettings);
    await flushPromises();
    expect(w.find('.text-danger').text()).toContain('Ошибка загрузки');
  });

  it('toggles a member active state via updateStaff and merges the result', async () => {
    mockList.mockResolvedValue([staff({ id: 1, is_active: true })]);
    mockUpdate.mockResolvedValue(staff({ id: 1, is_active: false }));
    const w = mount(StaffSettings);
    await flushPromises();

    // First action button is "Заблокировать".
    const toggleBtn = w.findAll('tbody button')[0];
    expect(toggleBtn.text()).toContain('Заблокировать');
    await toggleBtn.trigger('click');
    await flushPromises();

    expect(mockUpdate).toHaveBeenCalledWith(1, { is_active: false });
    expect(w.text()).toContain('Заблокирован');
    expect(w.findAll('tbody button')[0].text()).toContain('Активировать');
  });

  it('surfaces the backend error when a toggle fails', async () => {
    mockList.mockResolvedValue([staff({ id: 1 })]);
    mockUpdate.mockRejectedValue(new Error('last active staff'));
    const w = mount(StaffSettings);
    await flushPromises();
    await w.findAll('tbody button')[0].trigger('click');
    await flushPromises();
    expect(w.text()).toContain('last active staff');
  });

  it('uses a fallback message for non-Error toggle rejections', async () => {
    mockList.mockResolvedValue([staff({ id: 1 })]);
    mockUpdate.mockRejectedValue('x');
    const w = mount(StaffSettings);
    await flushPromises();
    await w.findAll('tbody button')[0].trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось обновить');
  });

  it('revokes access after confirmation and drops the member from the list', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    mockList.mockResolvedValue([
      staff({ id: 1, is_staff: true }),
      staff({ id: 2, email: 'keep@b.md', is_staff: true }),
    ]);
    mockUpdate.mockResolvedValue(staff({ id: 1, is_staff: false }));
    const w = mount(StaffSettings);
    await flushPromises();

    // Second action button in the first row is "Снять доступ".
    await w.findAll('tbody tr')[0].findAll('button')[1].trigger('click');
    await flushPromises();

    expect(mockUpdate).toHaveBeenCalledWith(1, { is_staff: false });
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('keep@b.md');
  });

  it('does nothing when the revoke confirmation is dismissed', async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    mockList.mockResolvedValue([staff({ id: 1 })]);
    const w = mount(StaffSettings);
    await flushPromises();
    await w.findAll('tbody tr')[0].findAll('button')[1].trigger('click');
    await flushPromises();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('surfaces the backend error when revoke fails', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    mockList.mockResolvedValue([staff({ id: 1 })]);
    mockUpdate.mockRejectedValue(new Error('cannot revoke last'));
    const w = mount(StaffSettings);
    await flushPromises();
    await w.findAll('tbody tr')[0].findAll('button')[1].trigger('click');
    await flushPromises();
    expect(w.text()).toContain('cannot revoke last');
  });

  it('uses a fallback message for non-Error revoke rejections', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    mockList.mockResolvedValue([staff({ id: 1 })]);
    mockUpdate.mockRejectedValue('x');
    const w = mount(StaffSettings);
    await flushPromises();
    await w.findAll('tbody tr')[0].findAll('button')[1].trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Не удалось снять доступ');
  });

  it('validates a missing email before creating', async () => {
    mockList.mockResolvedValue([staff()]);
    const w = mount(StaffSettings);
    await flushPromises();
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(w.text()).toContain('Введите email');
  });

  it('validates a too-short password before creating', async () => {
    mockList.mockResolvedValue([staff()]);
    const w = mount(StaffSettings);
    await flushPromises();
    await w.find('input[type="email"]').setValue('new@b.md');
    await w.find('input[type="password"]').setValue('short');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(w.text()).toContain('не короче 8 символов');
  });

  it('creates a member, sends a null phone when blank, and reloads the list', async () => {
    mockList.mockResolvedValue([staff()]);
    mockCreate.mockResolvedValue(staff({ id: 3, email: 'new@b.md' }));
    const w = mount(StaffSettings);
    await flushPromises();

    await w.find('input[type="email"]').setValue('  new@b.md  ');
    await w.find('input[type="password"]').setValue('password123');
    await w.find('form').trigger('submit');
    await flushPromises();

    expect(mockCreate).toHaveBeenCalledWith({
      email: 'new@b.md',
      password: 'password123',
      phone: null,
    });
    expect(w.text()).toContain('Сотрудник добавлен');
    // load() called twice: onMounted + after create.
    expect(mockList).toHaveBeenCalledTimes(2);
    // Fields cleared.
    expect((w.find('input[type="email"]').element as HTMLInputElement).value).toBe('');
  });

  it('sends a trimmed phone when provided', async () => {
    mockList.mockResolvedValue([staff()]);
    mockCreate.mockResolvedValue(staff({ id: 4 }));
    const w = mount(StaffSettings);
    await flushPromises();
    await w.find('input[type="email"]').setValue('p@b.md');
    await w.find('input[type="password"]').setValue('password123');
    await w.find('input[type="tel"]').setValue('  +37361111111  ');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(mockCreate).toHaveBeenCalledWith({
      email: 'p@b.md',
      password: 'password123',
      phone: '+37361111111',
    });
  });

  it('surfaces the backend error when create fails', async () => {
    mockList.mockResolvedValue([staff()]);
    mockCreate.mockRejectedValue(new Error('email taken'));
    const w = mount(StaffSettings);
    await flushPromises();
    await w.find('input[type="email"]').setValue('dup@b.md');
    await w.find('input[type="password"]').setValue('password123');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('email taken');
  });

  it('uses a fallback message for non-Error create rejections', async () => {
    mockList.mockResolvedValue([staff()]);
    mockCreate.mockRejectedValue('x');
    const w = mount(StaffSettings);
    await flushPromises();
    await w.find('input[type="email"]').setValue('dup@b.md');
    await w.find('input[type="password"]').setValue('password123');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Не удалось создать');
  });
});
