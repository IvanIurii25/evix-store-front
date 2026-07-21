// @ts-check
import process from 'node:process';

import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Public site URL (canonical / hreflang / sitemap). Env-driven so the built
  // image is deploy-agnostic; defaults to the prod domain.
  site: process.env.SITE_URL ?? 'https://shop.evix.md',

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
