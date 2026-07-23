/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro-aware Vitest config (shares the project's Vite pipeline, incl. the Vue
// integration so `.vue` islands compile and mount under @vue/test-utils).
export default getViteConfig({
  test: {
    // happy-dom gives Vue islands a DOM to mount into; plain-TS tests run fine
    // under it too (Node 20+ provides global fetch).
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts', 'tests/unit/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      // Count every runtime source file, not only those a test imports, so
      // untested files register as 0% rather than vanishing from the report.
      all: true,
      // Scope = runtime logic + Vue islands. `.astro` pages/layouts are SSR
      // markup covered behaviourally by Playwright e2e, not by unit coverage.
      include: [
        'src/lib/**/*.ts',
        'src/api/**/*.ts',
        'src/config/**/*.ts',
        'src/validation/**/*.ts',
        'src/middleware.ts',
        'src/pages/**/*.ts',
        'src/islands/**/*.vue',
      ],
      exclude: ['src/types/**', '**/*.d.ts', '**/*.{test,spec}.ts'],
      reporter: ['text', 'json-summary', 'html'],
      // Hard gate (`test:coverage`) is enabled in the final phase; omitted here
      // so iterative runs don't fail while coverage is still being built up.
    },
  },
});
