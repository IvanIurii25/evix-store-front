import MarkdownIt from 'markdown-it';

// Renderer for manager-authored content-page bodies. `html: false` escapes any
// raw HTML in the source, so stored Markdown can't inject <script> — the output
// is safe to set:html without a separate sanitizer. linkify turns bare URLs into
// links; typographer applies nicer quotes/dashes.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export function renderMarkdown(source: string): string {
  return md.render(source);
}
