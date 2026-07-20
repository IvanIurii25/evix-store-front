// @ts-check
import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Public site URL (canonical / sitemap). Override per environment.
  site: 'https://evix-store.md',

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
