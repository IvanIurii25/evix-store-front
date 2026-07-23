import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown to HTML', () => {
    const out = renderMarkdown('# Title\n\nHello **world**');
    expect(out).toContain('<h1>Title</h1>');
    expect(out).toContain('<strong>world</strong>');
  });

  it('escapes raw HTML in the source (html: false)', () => {
    const out = renderMarkdown('<script>evil()</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('linkifies bare URLs', () => {
    const out = renderMarkdown('see https://evix.md now');
    expect(out).toContain('<a href="https://evix.md">');
  });
});
