import createClient from 'openapi-fetch';

import { API_BASE } from '../config/env';
import type { paths } from '../types/api';

// Transient server statuses worth a quick retry (a backend cold-start / deploy
// blip / gateway hiccup) rather than surfacing as a hard failure.
const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 2;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry ONLY idempotent GET requests on transient 5xx / network errors, with a
// short backoff. Writes (POST/PATCH/DELETE) are never retried — they may have
// already applied server-side before the error, so a retry could double-submit.
export async function retryFetch(
  input: Request | string | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
  const canRetry = method === 'GET';

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(input as RequestInfo, init);
      if (canRetry && RETRY_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
        await delay(300 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      if (canRetry && attempt < MAX_RETRIES) {
        await delay(300 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

// Typed fetch client bound to the backend OpenAPI (src/types/api.d.ts, generated).
export const api = createClient<paths>({
  baseUrl: API_BASE,
  fetch: retryFetch,
});
