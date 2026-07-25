import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ShareButtons from './ShareButtons.vue';

const URL_RAW = 'https://shop.evix.md/ro/p/telefon-super';
const NAME = 'Telefon Super & Ieftin';

function mountShare(lang: 'ro' | 'ru' = 'ru') {
  return mount(ShareButtons, { props: { url: URL_RAW, name: NAME, lang } });
}

function href(w: ReturnType<typeof mount>, label: string): string {
  const a = w.findAll('a').find((el) => el.attributes('aria-label') === label)!;
  return a.attributes('href')!;
}

describe('ShareButtons', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds Facebook / Telegram / WhatsApp / Viber links with encoded url + name', () => {
    const w = mountShare('ro');
    const u = encodeURIComponent(URL_RAW);
    const n = encodeURIComponent(NAME);

    expect(href(w, 'Distribuie pe Facebook')).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    );
    expect(href(w, 'Distribuie pe Telegram')).toBe(
      `https://t.me/share/url?url=${u}&text=${n}`,
    );
    expect(href(w, 'Distribuie pe WhatsApp')).toBe(
      `https://wa.me/?text=${n}%20${u}`,
    );
    expect(href(w, 'Distribuie pe Viber')).toBe(
      `viber://forward?text=${n}%20${u}`,
    );
  });

  it('opens social links in a new tab with rel=noopener', () => {
    const w = mountShare('ru');
    const fb = w
      .findAll('a')
      .find((el) => el.attributes('aria-label') === 'Поделиться в Facebook')!;
    expect(fb.attributes('target')).toBe('_blank');
    expect(fb.attributes('rel')).toBe('noopener');
  });

  it('copies the raw url to the clipboard and shows the "copied" toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const w = mountShare('ru');
    await w.find('button').trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(URL_RAW);
    expect(w.text()).toContain('Скопировано ✓');
  });

  it('shows a fallback message when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});

    const w = mountShare('ru');
    await w.find('button').trigger('click');
    await flushPromises();

    expect(w.text()).toContain('Не удалось скопировать');
  });
});
