/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro-aware Vitest config (shares the project's Vite pipeline).
export default getViteConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts', 'tests/unit/**/*.{test,spec}.ts'],
  },
});
