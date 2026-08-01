// JS budget. The storefront and the admin panel ship from one build into one
// flat `_astro/` directory, so a single glob counted the back-office against the
// shopper's budget — which made the gate meaningless: it was ~33 kB over on
// chunks no visitor ever downloads (ContentPages alone is 112 kB raw).
//
// The two are budgeted separately. The admin list is derived from the source
// tree rather than hard-coded, so a new island under src/islands/admin/ leaves
// the storefront budget on its own — nobody has to remember this file.
//
// Vendor chunks shared by both (the Vue runtime, i18n strings) stay in the
// storefront budget on purpose: a shopper really does download them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ISLANDS = path.join(ROOT, 'src', 'islands', 'admin');

// Rollup names a chunk after its source module, so the island list is the chunk
// list. `admin` is the shared back-office chunk — not an island, but admin-only.
const adminChunks = fs
  .readdirSync(ADMIN_ISLANDS)
  .filter((file) => file.endsWith('.vue'))
  .map((file) => path.basename(file, '.vue'))
  .concat('admin');

const chunk = (name) => `dist/client/_astro/${name}.*.js`;

export default [
  {
    name: 'storefront JS (what a shopper downloads, brotli)',
    path: [
      'dist/client/_astro/*.js',
      ...adminChunks.map((name) => `!${chunk(name)}`),
    ],
    limit: '85 kB',
  },
  {
    name: 'admin panel JS (back-office only, brotli)',
    path: adminChunks.map(chunk),
    limit: '100 kB',
  },
];
