// @ts-check
import process from 'node:process';

import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// The API origin the browser talks to (client-side fetch). Same-origin on prod
// (shop.evix.md), but a distinct host in local dev — fold it into connect-src so
// the CSP adapts to the build's backend instead of hard-coding one origin.
const apiOrigin = (() => {
  try {
    return new URL(process.env.PUBLIC_API_BASE ?? 'https://shop.evix.md').origin;
  } catch {
    return 'https://shop.evix.md';
  }
})();

// https://astro.build/config
export default defineConfig({
  // Public site URL (canonical / hreflang / sitemap). Env-driven so the built
  // image is deploy-agnostic; defaults to the prod domain.
  site: process.env.SITE_URL ?? 'https://shop.evix.md',

  // Content-Security-Policy. Astro hashes every script/style it emits (island
  // hydration bootstraps, JSON-LD, is:inline, scoped <style>) into strict
  // script-src/style-src and ships the policy as a <meta http-equiv> — so no
  // 'unsafe-inline' for scripts. We only relax style-src (Vue runtime :style +
  // static inline style= attributes aren't build-time hashable; low XSS risk)
  // and declare the remaining directives. frame-ancestors isn't valid in a meta
  // CSP, so clickjacking stays covered by the X-Frame-Options header (middleware).
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // Cloudflare Web Analytics beacon POSTs its telemetry to cloudflareinsights.com.
        `connect-src 'self' ${apiOrigin} https://cloudflareinsights.com`,
        "img-src 'self' data: https://media.evix.md",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-src 'none'",
      ],
      scriptDirective: {
        // Cloudflare auto-injects its Web Analytics beacon at the edge; allow it
        // alongside Astro's own hashed scripts (still no wildcard/unsafe-inline).
        resources: ['https://static.cloudflareinsights.com'],
      },
      styleDirective: {
        // Astro adds hashes for its scoped <style> blocks (style-src). Once a
        // hash is present, the browser ignores 'unsafe-inline' in that same
        // directive — so put 'unsafe-inline' in style-src-attr instead, which
        // carries no hashes, to allow inline style= attributes + Vue :style.
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },

  // Indexable pages live under /[lang]/ (ro default, ru). Transactional pages
  // (cart/checkout/auth/account) stay at root for now.
  // Manual routing so we run Astro's i18n middleware ourselves and can exempt
  // the non-localized admin panel (/admin/*) — otherwise prefixDefaultLocale
  // treats "admin" as an invalid locale and 404s it. See src/middleware.ts.
  i18n: {
    defaultLocale: 'ro',
    locales: ['ro', 'ru'],
    routing: 'manual',
  },

  integrations: [vue()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: 'standalone',
  }),
});
