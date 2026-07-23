import { describe, expect, it } from 'vitest';

import { RESPONSIVE_WIDTHS, webpSrcset } from './img';

describe('RESPONSIVE_WIDTHS', () => {
  it('lists the expected variant widths', () => {
    expect(RESPONSIVE_WIDTHS).toEqual([200, 400, 800, 1200]);
  });
});

describe('webpSrcset', () => {
  it('returns empty string for missing/empty urls', () => {
    expect(webpSrcset('')).toBe('');
    expect(webpSrcset(null)).toBe('');
    expect(webpSrcset(undefined)).toBe('');
  });

  it('strips the original extension and builds one WebP entry per width', () => {
    const out = webpSrcset('https://media.evix.md/media/abc.png');
    expect(out).toBe(
      'https://media.evix.md/media/abc_200.webp 200w, ' +
        'https://media.evix.md/media/abc_400.webp 400w, ' +
        'https://media.evix.md/media/abc_800.webp 800w, ' +
        'https://media.evix.md/media/abc_1200.webp 1200w',
    );
  });

  it('only strips the final extension segment, keeping earlier dots', () => {
    const out = webpSrcset('https://media.evix.md/media/foo.bar.jpeg');
    expect(out).toContain('https://media.evix.md/media/foo.bar_200.webp 200w');
  });
});
