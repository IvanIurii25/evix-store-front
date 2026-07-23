# E2E scenario tests (Playwright)

End-to-end **read-only** checks of the most frequent storefront journeys, run by
Playwright against the live site **https://shop.evix.md** (or any URL you point
`E2E_BASE_URL` at). Playwright walks each test case itself and writes an HTML
report you can open afterwards.

**Read-only & safe:** these never place an order, create an account, or touch
the admin — so they don't pollute production data. Mutating flows (checkout,
admin CRUD) are intentionally excluded here; run those against a local stack.

## One-time setup

```bash
pnpm install
pnpm test:e2e:install        # downloads the Chromium build Playwright needs
```

## Run everything (+ auto HTML report)

```bash
pnpm test:e2e                # all scenarios, desktop + mobile, against prod
pnpm test:e2e:report         # open the HTML report from the last run
```

The run prints a live pass/fail list to the console and writes a self-contained
report to `playwright-report/` (git-ignored). On a failure it also captures a
screenshot, video and trace under `test-results/` — inspect a trace with
`pnpm exec playwright show-trace test-results/<...>/trace.zip`.

## Run a subset

```bash
pnpm test:e2e tests/e2e/03-i18n.spec.ts        # one scenario file
pnpm test:e2e -g "language switch"             # by title (grep)
pnpm test:e2e --project=desktop-chromium       # one viewport only
pnpm test:e2e --project=mobile-chrome
```

## Debug / author

```bash
pnpm test:e2e:ui                # interactive UI mode (time-travel, watch)
pnpm test:e2e:headed            # watch the real browser
pnpm test:e2e tests/e2e/02-search.spec.ts --debug   # step with the inspector
```

## Point at a different environment

```bash
# local dev stack (astro dev on :4321 + backend on :58000)
E2E_BASE_URL=http://localhost:4321 pnpm test:e2e
# a staging URL
E2E_BASE_URL=https://staging.evix.md pnpm test:e2e
```

## Scenario catalogue

| File                    | Journey (why it's frequent)                      | Key assertions                                                                                                                                           |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-discovery.spec.ts`  | Home → category → product — the core browse path | `/`→`/ro` redirect, `html lang`, search box, category tiles + product links present; category h1 + product grid; PDP h1 + `Код:` + price + action button |
| `02-search.spec.ts`     | Product search (instant + results page)          | Debounced dropdown shows hits for a real term; `/ro/search?q=` returns products; nonsense query → 0 results                                              |
| `03-i18n.spec.ts`       | Bilingual ro↔ru                                  | root → `/ro`; header switch ro→ru changes `html lang`; PDP has ro+ru `hreflang` alternates                                                               |
| `04-catalog.spec.ts`    | Category sort + pagination                       | sort `<select>` writes `?sort=price_asc`; "Показать ещё" appends more products                                                                           |
| `05-seo.spec.ts`        | SEO/meta correctness                             | title/description/canonical(https)/OpenGraph; Product+BreadcrumbList JSON-LD; sitemap + robots.txt reachable; pre-launch `noindex` meta                  |
| `06-info-pages.spec.ts` | Footer legal/info pages                          | footer lists `/info/*` pages; opening one renders an h1                                                                                                  |

Run just one journey with `pnpm test:e2e tests/e2e/<file>`.

## Notes

- **Search term is derived at runtime** from a real product name on the home
  page (`helpers.ts::deriveSearchTerm`), so the search scenario always queries
  something the catalogue actually contains — no brittle hard-coded terms.
- **`05-seo` noindex check is a pre-launch guard.** The store is intentionally
  `SITE_NOINDEX=true` until launch. When you launch (`SITE_NOINDEX=false`),
  update or drop that one assertion.
- **CI:** this suite depends on an external, live origin, so it is _not_ wired
  into the main `pnpm check` gate (which stays hermetic: lint + typecheck +
  vitest). Run it on demand, or add a scheduled workflow that runs
  `pnpm test:e2e` and uploads `playwright-report/` as an artifact.
- **Extending to mutating flows** (add-to-cart → checkout, admin CRUD): point
  `E2E_BASE_URL` at a disposable local/staging stack with a seeded DB, then add
  specs under this folder — do **not** run order/admin mutations against prod.
