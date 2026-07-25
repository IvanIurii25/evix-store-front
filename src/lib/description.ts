import sanitizeHtml from 'sanitize-html';

import { webpSrcset } from './img';

// Product descriptions are imported/admin-authored HTML (WooCommerce-style
// markup with <p>/<br>/<img>). They must render as HTML (not escaped text), so
// this module prepares that HTML for a v-html render: it runs the markup through
// a real allowlist sanitizer (defense-in-depth — the source is trusted staff,
// not end users, but a parser-based allowlist is not bypassable the way a regex
// scrub is) and rewrites our own media <img> tags to lazy-loaded, WebP-served
// <picture>s (the responsive variants already exist alongside each original in
// MinIO). Runs SSR-only (p/[slug].astro frontmatter), so the Node-side
// sanitize-html never reaches the client bundle.

// Allowlist: the formatting/structure tags a product description legitimately
// uses. Anything else (script/style/iframe/object/embed/form/input/…) is
// dropped, along with every event-handler attribute and any non-http(s) URL
// scheme — sanitize-html enforces all of this by construction.
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'span',
    'div',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'small',
    'sub',
    'sup',
    'mark',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'a',
    'img',
    'figure',
    'figcaption',
    'picture',
    'source',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
    'caption',
    'colgroup',
    'col',
    'blockquote',
    'pre',
    'code',
  ],
  allowedAttributes: {
    '*': ['class', 'style', 'id', 'title', 'dir', 'lang'],
    a: ['href', 'target', 'rel', 'name'],
    img: [
      'src',
      'alt',
      'width',
      'height',
      'loading',
      'decoding',
      'srcset',
      'sizes',
    ],
    source: ['src', 'srcset', 'sizes', 'type', 'media'],
    td: ['colspan', 'rowspan', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'align', 'valign', 'scope'],
    col: ['span', 'width'],
    colgroup: ['span', 'width'],
  },
  // Only http(s) (+ mail/tel on links); drops javascript:/data:/vbscript: URLs.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // External links open safely (no reverse-tabnabbing, no referrer leak).
  transformTags: {
    a: sanitizeHtml.simpleTransform(
      'a',
      { rel: 'noopener noreferrer nofollow' },
      false,
    ),
  },
};

function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTS);
}

// Only our own media host — its originals have generated WebP variants, so the
// <picture> WebP source never 404s. External images are left untouched.
const MEDIA_IMG =
  /<img\b[^>]*\bsrc\s*=\s*"(https:\/\/media\.evix\.md\/[^"]+\.(?:jpe?g|png))"[^>]*>/gi;

function toPicture(tag: string, src: string): string {
  let img = tag;
  if (!/\bloading\s*=/i.test(img))
    img = img.replace(/<img\b/i, '<img loading="lazy"');
  if (!/\bdecoding\s*=/i.test(img))
    img = img.replace(/<img\b/i, '<img decoding="async"');
  const srcset = webpSrcset(src);
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="(min-width: 768px) 768px, 100vw">${img}</picture>`;
}

export function optimizeDescriptionHtml(
  html: string | null | undefined,
): string {
  if (!html) return '';
  return sanitize(html).replace(MEDIA_IMG, (tag, src) => toPicture(tag, src));
}
