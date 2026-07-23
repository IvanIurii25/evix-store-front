import { webpSrcset } from './img';

// Product descriptions are imported/admin-authored HTML (WooCommerce-style
// markup with <p>/<br>/<img>). They must render as HTML (not escaped text), so
// this module prepares that HTML for a v-html render: it strips the main XSS
// vectors (defense-in-depth — the source is trusted staff, not end users) and
// rewrites our own media <img> tags to lazy-loaded, WebP-served <picture>s
// (the responsive variants already exist alongside each original in MinIO).

// Remove <script>/<style>/<iframe>/<object>/<embed> blocks, inline event-handler
// attributes (onclick=…), and javascript: URLs.
function sanitize(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

// Only our own media host — its originals have generated WebP variants, so the
// <picture> WebP source never 404s. External images are left untouched.
const MEDIA_IMG =
  /<img\b[^>]*\bsrc\s*=\s*"(https:\/\/media\.evix\.md\/[^"]+\.(?:jpe?g|png))"[^>]*>/gi;

function toPicture(tag: string, src: string): string {
  let img = tag;
  if (!/\bloading\s*=/i.test(img)) img = img.replace(/<img\b/i, '<img loading="lazy"');
  if (!/\bdecoding\s*=/i.test(img))
    img = img.replace(/<img\b/i, '<img decoding="async"');
  const srcset = webpSrcset(src);
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="(min-width: 768px) 768px, 100vw">${img}</picture>`;
}

export function optimizeDescriptionHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitize(html).replace(MEDIA_IMG, (tag, src) => toPicture(tag, src));
}
