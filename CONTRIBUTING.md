# Contributing

`main` is protected: **no direct pushes** — every change lands through a pull
request with green CI (`quality` + `lighthouse` + `e2e`).

## Prerequisites

- **Node 22** (`.nvmrc`) via nvm; **pnpm** (version pinned in `packageManager`).

  ```bash
  nvm use && pnpm install
  pnpm test:e2e:install   # Playwright browser, for e2e
  ```

## Workflow

1. Branch from an up-to-date `main`:

   ```bash
   git checkout main && git pull
   git checkout -b <type>/<short-desc>   # e.g. feat/wishlist
   ```

2. Make your change. Use Conventional Commit messages (`feat:`, `fix:`, `test:`,
   `docs:`, `ci:`, `style:`, `refactor:`, `chore:`).

3. Run the checks locally (mirror CI) so the PR passes first time — see below.

4. Push and open a PR:

   ```bash
   git push -u origin <branch>
   gh pr create --base main --fill
   ```

5. CI runs on the PR. When **quality**, **lighthouse** and **e2e** are all green,
   merge (no approval required):

   ```bash
   gh pr merge --squash --delete-branch
   ```

   `git push origin main` is rejected by branch protection — always go through a PR.

## Local checks (mirror CI)

```bash
pnpm check              # eslint + prettier + astro check + vitest
pnpm test:coverage      # unit coverage gate (≥90% on all metrics)
pnpm build && pnpm size # SSR build + JS budget (≤125 kB)
pnpm test:e2e           # Playwright read-only scenarios vs prod shop.evix.md
```

`pnpm typecheck` (astro check) requires Node 22.

## CI jobs

- **quality** — eslint · prettier · astro check · vitest coverage ≥90% · build · size ≤125 kB
- **lighthouse** — a11y / best-practices gates on the prod home; SEO is advisory
  (`warn`) while the store is pre-launch `noindex` (flip to `error` at launch)
- **e2e** — read-only Playwright scenarios (desktop + mobile) vs `shop.evix.md`

## Tests

Unit/component tests are co-located as `<name>.test.ts` (Vitest +
`@vue/test-utils` + happy-dom); coverage must stay **≥90%**. E2E specs live in
`tests/e2e/` and run read-only against production — see `tests/e2e/README.md`.
Astro pages/layouts (`.astro`) are covered behaviourally by e2e, not unit coverage.
