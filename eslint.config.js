import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    // TODO(F2 follow-up): add eslint-plugin-vue and lint islands too.
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'src/types/api.d.ts',
      '**/*.vue',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
];
