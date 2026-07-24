# evix-store-front

[![CI](https://github.com/IvanIurii25/evix-store-front/actions/workflows/ci.yml/badge.svg)](https://github.com/IvanIurii25/evix-store-front/actions/workflows/ci.yml)

Storefront for **evix-store** (backend: `store-evix`). **Astro + Vue 3 islands +
Tailwind v4**, Node SSR adapter. Stage **F0 — skeleton** (no design yet).

Minimum JS by default (Astro ships HTML; interactivity only via Vue islands).
Design spec: `PersonalAssistant/проекты/evix/flystore/frontend-analysis.md`.

## Requirements

- **Node 22** (`.nvmrc` → `nvm use`) — Astro 7 requires `>=22.12`.
- **pnpm** 10.

## Quick start

```bash
nvm use              # Node 22
pnpm install
cp .env.example .env
pnpm dev             # http://localhost:4321
```

## Commands (`make help` / package.json)

| Command                                      | What it does                                            |
| -------------------------------------------- | ------------------------------------------------------- |
| `make dev` / `pnpm dev`                      | Dev server (hot reload)                                 |
| `make build`                                 | Production build (Node SSR)                             |
| `make preview`                               | Preview built server                                    |
| `make lint` / `lint:fix`                     | ESLint                                                  |
| `make format` / `format-check`               | Prettier                                                |
| `make typecheck`                             | `astro check`                                           |
| `make test` / `test:watch` / `test:coverage` | Unit tests (Vitest)                                     |
| `make test-e2e`                              | E2E (Playwright)                                        |
| `make check`                                 | lint + format-check + typecheck + tests (local CI gate) |
| `make gen-api`                               | Generate `src/types/api.d.ts` from backend OpenAPI      |

## Structure

```
src/
  layouts/      Layout.astro (html/head/body, SEO, imports global.css)
  pages/        Astro routes (SSG/SSR)
  components/   .astro presentational (no JS)
  islands/      .vue interactive islands (Vue 3)
  api/          typed fetch client to the backend (per-domain)
  validation/   zod schemas (forms)
  types/        api.d.ts (generated from OpenAPI) + shared types
  config/       env/runtime config
  lib/          helpers (auth, format, seo)
  styles/       global.css (Tailwind v4)
tests/          unit (vitest) + e2e (playwright)
```

## Tooling

Adopted from the SmartSuggestApp project (React, but framework-agnostic tooling):
ESLint (flat) + Prettier + `astro check` + **Vitest** (unit) + **Playwright** (e2e) +
**zod** validation + the full script set + Makefile + CI. API types are **generated**
from the backend's OpenAPI (`pnpm gen:api`), not hand-written.

Backend API base is `PUBLIC_API_BASE` (default `http://localhost:58000/api/v1`).
