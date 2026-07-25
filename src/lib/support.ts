// Telegram support deep-link helper.
//
// Builds a `t.me/<bot>?start=<payload>` URL so a storefront button opens the
// support bot with context (the backend resolves the `start` payload on the
// first `/start` message). Returns null when no bot username is configured, so
// callers hide the affordance entirely.
import { TELEGRAM_BOT_USERNAME } from '../config/env';

// Telegram `start` payloads accept only [A-Za-z0-9_-], max 64 chars.
function sanitizePayload(payload: string): string {
  return payload.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

// A product-context payload for the product-detail button (`p<id>`).
export function productPayload(productId: number): string {
  return `p${productId}`;
}

export function supportDeepLink(payload?: string): string | null {
  if (!TELEGRAM_BOT_USERNAME) return null;
  const base = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
  const clean = payload ? sanitizePayload(payload) : '';
  return clean ? `${base}?start=${clean}` : base;
}
