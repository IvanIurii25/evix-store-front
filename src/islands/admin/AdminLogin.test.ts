import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const login = vi.fn();

vi.mock('../../api/auth', () => ({
  login: (...a: unknown[]) => login(...a),
}));

import AdminLogin from './AdminLogin.vue';

let hrefStore = '';
beforeEach(() => {
  vi.clearAllMocks();
  hrefStore = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return hrefStore;
      },
      set href(v: string) {
        hrefStore = v;
      },
    },
  });
});

async function fill(
  wrapper: ReturnType<typeof mount>,
  email: string,
  password: string,
) {
  await wrapper.find('input[type="email"]').setValue(email);
  await wrapper.find('input[type="password"]').setValue(password);
}

describe('AdminLogin', () => {
  it('renders the form with disabled-when-busy submit button labelled "Войти"', () => {
    const wrapper = mount(AdminLogin);
    const btn = wrapper.find('button[type="submit"]');
    expect(btn.text()).toBe('Войти');
    expect(btn.attributes('disabled')).toBeUndefined();
  });

  it('validates empty fields before calling login', async () => {
    const wrapper = mount(AdminLogin);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Введите email и пароль');
    expect(login).not.toHaveBeenCalled();
    expect(hrefStore).toBe('');
  });

  it('requires the password too (email present, password blank)', async () => {
    const wrapper = mount(AdminLogin);
    await wrapper.find('input[type="email"]').setValue('a@b.com');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Введите email и пароль');
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in and redirects to /admin by default', async () => {
    login.mockResolvedValue(undefined);
    const wrapper = mount(AdminLogin);
    await fill(wrapper, 'admin@shop.md', 'pass123');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(login).toHaveBeenCalledWith({ email: 'admin@shop.md' }, 'pass123');
    expect(hrefStore).toBe('/admin');
  });

  it('honors the next prop as the redirect target', async () => {
    login.mockResolvedValue(undefined);
    const wrapper = mount(AdminLogin, { props: { next: '/admin/orders' } });
    await fill(wrapper, 'admin@shop.md', 'pass123');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(hrefStore).toBe('/admin/orders');
  });

  it('submits via Enter on the password field', async () => {
    login.mockResolvedValue(undefined);
    const wrapper = mount(AdminLogin);
    await fill(wrapper, 'admin@shop.md', 'pass123');
    await wrapper.find('input[type="password"]').trigger('keyup.enter');
    await flushPromises();

    expect(login).toHaveBeenCalledTimes(1);
    expect(hrefStore).toBe('/admin');
  });

  it('surfaces the Error message on a failed login and does not redirect', async () => {
    login.mockRejectedValue(new Error('Неверный логин или пароль'));
    const wrapper = mount(AdminLogin);
    await fill(wrapper, 'admin@shop.md', 'wrong');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Неверный логин или пароль');
    expect(hrefStore).toBe('');
  });

  it('falls back to the generic message on a non-Error throw', async () => {
    login.mockRejectedValue('boom');
    const wrapper = mount(AdminLogin);
    await fill(wrapper, 'admin@shop.md', 'wrong');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Ошибка входа');
  });
});
