import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const login = vi.fn();
const register = vi.fn();
const mergeCart = vi.fn();

vi.mock('../api/auth', () => ({
  login: (...a: unknown[]) => login(...a),
  register: (...a: unknown[]) => register(...a),
}));
vi.mock('../api/cart', () => ({
  mergeCart: (...a: unknown[]) => mergeCart(...a),
}));

import AuthForm from './AuthForm.vue';

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

async function fill(wrapper: ReturnType<typeof mount>, email: string, password: string) {
  const inputs = wrapper.findAll('input');
  await inputs[0].setValue(email); // email/phone
  await wrapper.find('input[type="password"]').setValue(password);
}

describe('AuthForm', () => {
  it('defaults to login mode: no phone field, "войти" label', () => {
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    // login mode has 2 inputs (email + password), no phone.
    expect(wrapper.findAll('input')).toHaveLength(2);
    expect(wrapper.find('button[type="submit"]').text()).toBe('Войти');
  });

  it('switches to register mode, revealing the phone field, and back to login', async () => {
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    const registerTab = wrapper.findAll('button').find((b) => b.text() === 'Регистрация')!;
    await registerTab.trigger('click');
    expect(wrapper.findAll('input')).toHaveLength(3);
    expect(wrapper.find('button[type="submit"]').text()).toBe('Зарегистрироваться');

    // Click the login tab handler (`mode = 'login'`) to switch back.
    const loginTab = wrapper.findAll('button').find((b) => b.text() === 'Вход')!;
    await loginTab.trigger('click');
    expect(wrapper.findAll('input')).toHaveLength(2);
    expect(wrapper.find('button[type="submit"]').text()).toBe('Войти');
  });

  it('rejects a short password before calling the API', async () => {
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await fill(wrapper, 'a@b.com', '123');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Пароль — минимум 6 символов');
    expect(login).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('logs in with email identity, merges cart, and redirects to account by default', async () => {
    login.mockResolvedValue(undefined);
    mergeCart.mockResolvedValue(undefined);
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await fill(wrapper, 'user@example.com', 'secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(login).toHaveBeenCalledWith({ email: 'user@example.com' }, 'secret1');
    expect(mergeCart).toHaveBeenCalled();
    expect(hrefStore).toBe('/ru/account');
  });

  it('logs in with phone identity when the value has no @', async () => {
    login.mockResolvedValue(undefined);
    mergeCart.mockResolvedValue(undefined);
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await fill(wrapper, '060123456', 'secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(login).toHaveBeenCalledWith({ phone: '060123456' }, 'secret1');
  });

  it('honors a safe next redirect', async () => {
    login.mockResolvedValue(undefined);
    mergeCart.mockResolvedValue(undefined);
    const wrapper = mount(AuthForm, { props: { lang: 'ru', next: '/ru/checkout' } });
    await fill(wrapper, 'user@example.com', 'secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(hrefStore).toBe('/ru/checkout');
  });

  it('ignores an unsafe (non-/) next and falls back to account', async () => {
    login.mockResolvedValue(undefined);
    mergeCart.mockResolvedValue(undefined);
    const wrapper = mount(AuthForm, {
      props: { lang: 'ru', next: 'https://evil.example/phish' },
    });
    await fill(wrapper, 'user@example.com', 'secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(hrefStore).toBe('/ru/account');
  });

  it('registers then logs in, tolerating a mergeCart failure', async () => {
    register.mockResolvedValue(undefined);
    login.mockResolvedValue(undefined);
    mergeCart.mockRejectedValue(new Error('merge boom'));
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await wrapper.findAll('button').find((b) => b.text() === 'Регистрация')!.trigger('click');

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('new@example.com'); // email
    await inputs[1].setValue('069000000'); // phone
    await wrapper.find('input[type="password"]').setValue('secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(register).toHaveBeenCalledWith('new@example.com', 'secret1', '069000000');
    expect(login).toHaveBeenCalledWith({ email: 'new@example.com' }, 'secret1');
    // merge failure is swallowed → still redirects.
    expect(hrefStore).toBe('/ru/account');
  });

  it('blocks registration with an invalid email (no @) after password passes', async () => {
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await wrapper.findAll('button').find((b) => b.text() === 'Регистрация')!.trigger('click');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('not-an-email');
    await wrapper.find('input[type="password"]').setValue('secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Введите корректный email');
    expect(register).not.toHaveBeenCalled();
  });

  it('surfaces the Error message from a failed login', async () => {
    login.mockRejectedValue(new Error('Неверный логин или пароль'));
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await fill(wrapper, 'user@example.com', 'secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Неверный логин или пароль');
    expect(mergeCart).not.toHaveBeenCalled();
    expect(hrefStore).toBe('');
  });

  it('falls back to the generic error for a non-Error throw', async () => {
    login.mockRejectedValue('weird');
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await fill(wrapper, 'user@example.com', 'secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Ошибка');
  });

  it('passes phone as undefined to register when the phone field is blank', async () => {
    register.mockResolvedValue(undefined);
    login.mockResolvedValue(undefined);
    mergeCart.mockResolvedValue(undefined);
    const wrapper = mount(AuthForm, { props: { lang: 'ru' } });
    await wrapper.findAll('button').find((b) => b.text() === 'Регистрация')!.trigger('click');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('new@example.com');
    await wrapper.find('input[type="password"]').setValue('secret1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(register).toHaveBeenCalledWith('new@example.com', 'secret1', undefined);
  });
});
