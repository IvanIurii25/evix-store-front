import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import vue from 'eslint-plugin-vue';

export default [
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'src/types/api.d.ts'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  // Essential (correctness) only — Prettier owns .vue formatting, so the
  // stylistic vue rules would just fight it.
  ...vue.configs['flat/essential'],
  {
    // Parse <script lang="ts"> in .vue with the TS parser (vue-eslint-parser
    // handles the SFC and delegates script blocks to this one).
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
    rules: {
      // Islands are intentionally single-word (Cart, Addresses, SearchBox…).
      'vue/multi-word-component-names': 'off',
      // TypeScript + `astro check` resolve identifiers (incl. browser globals);
      // the base rule would false-positive on setTimeout/location/etc.
      'no-undef': 'off',
    },
  },
  {
    // Node build/tooling scripts (asset generators, astro config) — declare the
    // Node globals they use so `no-undef` doesn't flag console/process/Buffer/URL.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
];
