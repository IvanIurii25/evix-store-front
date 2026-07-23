import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const BASE = 'http://localhost:58000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(status: number): Response {
  return jsonResponse({ error: { code: 'E', message: 'x' } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubOnce(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function req(): Request {
  return fetchMock.mock.calls[0][0] as Request;
}

async function load() {
  return import('./auth');
}

describe('auth api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('login POSTs the identifier + password and returns data', async () => {
    stubOnce(jsonResponse({ id: 1, email: 'a@b.c' }));
    const { login } = await load();
    const res = await login({ email: 'a@b.c' }, 'secret');
    expect(res).toEqual({ id: 1, email: 'a@b.c' });
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.credentials).toBe('include');
    expect(r.url).toBe(`${BASE}/api/v1/auth/login`);
    expect(await r.text()).toBe('{"email":"a@b.c","password":"secret"}');
  });

  it('login throws the credential message on 401', async () => {
    stubOnce(envelope(401));
    const { login } = await load();
    await expect(login({ email: 'a@b.c' }, 'x')).rejects.toThrow(
      'Неверный логин или пароль',
    );
  });

  it('login throws the generic message on other errors', async () => {
    stubOnce(envelope(500));
    const { login } = await load();
    await expect(login({ phone: '123' }, 'x')).rejects.toThrow('Ошибка входа');
  });

  it('register POSTs email/password/phone', async () => {
    stubOnce(jsonResponse({ id: 2 }, 201));
    const { register } = await load();
    const res = await register('a@b.c', 'pw', '123');
    expect(res).toEqual({ id: 2 });
    expect(await req().text()).toBe(
      '{"email":"a@b.c","password":"pw","phone":"123"}',
    );
  });

  it('register sends null phone when omitted', async () => {
    stubOnce(jsonResponse({ id: 3 }, 201));
    const { register } = await load();
    await register('a@b.c', 'pw');
    expect(await req().text()).toBe(
      '{"email":"a@b.c","password":"pw","phone":null}',
    );
  });

  it('register throws the conflict message on 409', async () => {
    stubOnce(envelope(409));
    const { register } = await load();
    await expect(register('a@b.c', 'pw')).rejects.toThrow(
      'Пользователь с таким email/телефоном уже есть',
    );
  });

  it('register throws the generic message on other errors', async () => {
    stubOnce(envelope(422));
    const { register } = await load();
    await expect(register('a@b.c', 'pw')).rejects.toThrow('Ошибка регистрации');
  });

  it('logout POSTs to the logout endpoint', async () => {
    stubOnce(jsonResponse(null, 204));
    const { logout } = await load();
    await expect(logout()).resolves.toBeUndefined();
    const r = req();
    expect(r.method).toBe('POST');
    expect(r.url).toBe(`${BASE}/api/v1/auth/logout`);
  });

  it('meWithToken sends the bearer token and returns the user', async () => {
    stubOnce(jsonResponse({ id: 1, email: 'a@b.c' }));
    const { meWithToken } = await load();
    const res = await meWithToken('tok123');
    expect(res).toEqual({ id: 1, email: 'a@b.c' });
    const r = req();
    expect(r.url).toBe(`${BASE}/api/v1/users/me`);
    expect(r.headers.get('authorization')).toBe('Bearer tok123');
  });

  it('meWithToken returns null on error', async () => {
    stubOnce(envelope(401));
    const { meWithToken } = await load();
    await expect(meWithToken('tok123')).resolves.toBeNull();
  });
});
