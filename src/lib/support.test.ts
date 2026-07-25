import { describe, it, expect, vi, afterEach } from 'vitest';

// supportDeepLink reads TELEGRAM_BOT_USERNAME from config/env at import time, so
// each test mocks that module and re-imports the helper.
async function loadWith(username: string) {
  vi.resetModules();
  vi.doMock('../config/env', () => ({ TELEGRAM_BOT_USERNAME: username }));
  return import('./support');
}

afterEach(() => {
  vi.doUnmock('../config/env');
  vi.resetModules();
});

describe('support deep-link', () => {
  it('productPayload formats p<id>', async () => {
    const { productPayload } = await loadWith('evix_bot');
    expect(productPayload(123)).toBe('p123');
  });

  it('builds a t.me start link when a bot is configured', async () => {
    const { supportDeepLink } = await loadWith('evix_bot');
    expect(supportDeepLink('p123')).toBe('https://t.me/evix_bot?start=p123');
  });

  it('returns the bare bot link when no payload is given', async () => {
    const { supportDeepLink } = await loadWith('evix_bot');
    expect(supportDeepLink()).toBe('https://t.me/evix_bot');
  });

  it('sanitizes the payload to [A-Za-z0-9_-] and caps it at 64 chars', async () => {
    const { supportDeepLink } = await loadWith('evix_bot');
    expect(supportDeepLink('p1/2 3<x>')).toBe(
      'https://t.me/evix_bot?start=p123x',
    );
    const long = 'a'.repeat(80);
    expect(supportDeepLink(long)).toBe(
      `https://t.me/evix_bot?start=${'a'.repeat(64)}`,
    );
  });

  it('returns null when no bot username is configured (feature off)', async () => {
    const { supportDeepLink } = await loadWith('');
    expect(supportDeepLink('p1')).toBeNull();
  });
});
