// @ts-check
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
  i18n: {
    defaultLocale: 'ro',
    locales: ['ro', 'ru'],
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: true },
  },

  integrations: [vue()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: 'standalone',
  }),
});
