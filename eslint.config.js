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
];
