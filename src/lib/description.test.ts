import { describe, expect, it } from 'vitest';

import { optimizeDescriptionHtml } from './description';

describe('optimizeDescriptionHtml', () => {
  it('returns empty string for nullish input', () => {
    expect(optimizeDescriptionHtml(null)).toBe('');
    expect(optimizeDescriptionHtml(undefined)).toBe('');
    expect(optimizeDescriptionHtml('')).toBe('');
  });

  it('wraps our media images in a lazy WebP <picture>', () => {
    const src = 'https://media.evix.md/evix-media/media/abc123.png';
    const out = optimizeDescriptionHtml(
      `<p><img src="${src}" width="900" /></p>`,
    );
    expect(out).toContain('<picture>');
    expect(out).toContain('type="image/webp"');
    expect(out).toContain('media/abc123_800.webp 800w');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    // original kept as the <img> fallback (with its width preserved)
    expect(out).toContain(`src="${src}"`);
    expect(out).toContain('width="900"');
  });

  it('leaves non-media (external) images untouched', () => {
    const html = '<img src="https://example.com/x.jpg" />';
    const out = optimizeDescriptionHtml(html);
    expect(out).not.toContain('<picture>');
    expect(out).toContain('https://example.com/x.jpg');
  });

  it('keeps existing loading/decoding attrs instead of duplicating them', () => {
    const src = 'https://media.evix.md/evix-media/media/xyz.jpg';
    const out = optimizeDescriptionHtml(
      `<img src="${src}" loading="eager" decoding="sync" />`,
    );
    expect(out).toContain('<picture>');
    expect(out).toContain('loading="eager"');
    expect(out).toContain('decoding="sync"');
    // not re-added
    expect(out).not.toContain('loading="lazy"');
    expect(out).not.toContain('decoding="async"');
  });

  it('strips script/iframe blocks and inline handlers', () => {
    const html =
      '<p onclick="steal()">hi</p><script>evil()</script>' +
      '<iframe src="javascript:alert(1)"></iframe>';
    const out = optimizeDescriptionHtml(html);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('evil()');
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('<p>hi</p>');
  });
});
