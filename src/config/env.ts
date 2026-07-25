// Runtime config. PUBLIC_ vars are exposed to the client bundle.
//
// API base differs by side:
// - Browser (islands): the public, same-origin base (baked at build).
// - Server (SSR): an internal base if provided (e.g. http://app:8000 in the
//   compose network) so SSR never hairpins out through the edge. Read from
//   process.env at runtime; the branch is tree-shaken out of the client bundle.
const PUBLIC_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:58000';

export const API_BASE = import.meta.env.SSR
  ? (process.env.API_INTERNAL_BASE ?? PUBLIC_BASE)
  : PUBLIC_BASE;

export const DEFAULT_LANG = import.meta.env.PUBLIC_DEFAULT_LANG ?? 'ro';

// Telegram support bot username (without @). When set, storefront "Написать в
// поддержку" deep-links are shown; empty → the feature is hidden.
export const TELEGRAM_BOT_USERNAME =
  import.meta.env.PUBLIC_TELEGRAM_BOT_USERNAME ?? '';
