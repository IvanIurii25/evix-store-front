// Cookie-consent contract shared by the SSR middleware (which gates analytics)
// and the client banner island (which records the decision). Single source of
// truth so both sides agree on the cookie name, format and policy version.
//
// LP195/2024 (= GDPR): the first-party analytics `sid` cookie + pageview must
// not fire without the visitor's consent. `necessary` cookies (cart/auth) are
// out of scope of the banner and always allowed.

export const CONSENT_COOKIE = 'evix_consent';
export const ANON_COOKIE = 'evix_aid';

// Bump when the cookie/privacy policy changes materially → a stored consent with
// an older version is treated as absent and the banner re-appears. Must match
// the backend `CONSENT_POLICY_VERSION`.
export const CONSENT_POLICY_VERSION = 1;

// ~13 months — the consent decision persists across visits (a necessary cookie).
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 400;

export interface ConsentState {
  version: number;
  analytics: boolean;
}

/** Parse the compact `"<version>:<all|necessary>"` cookie value. */
export function parseConsent(
  raw: string | undefined | null,
): ConsentState | null {
  if (!raw) return null;
  const [v, choice] = raw.split(':');
  const version = Number(v);
  if (
    !Number.isInteger(version) ||
    (choice !== 'all' && choice !== 'necessary')
  ) {
    return null;
  }
  return { version, analytics: choice === 'all' };
}

/** True only when a *current-version* decision granted analytics. */
export function analyticsGranted(raw: string | undefined | null): boolean {
  const state = parseConsent(raw);
  return (
    state !== null &&
    state.version === CONSENT_POLICY_VERSION &&
    state.analytics
  );
}

/** Serialize a decision into the cookie value. */
export function serializeConsent(analytics: boolean): string {
  return `${CONSENT_POLICY_VERSION}:${analytics ? 'all' : 'necessary'}`;
}
