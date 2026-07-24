import { describe, expect, it } from 'vitest';

import {
  analyticsGranted,
  CONSENT_POLICY_VERSION,
  parseConsent,
  serializeConsent,
} from './consent';

describe('parseConsent', () => {
  it('parses a current "all" decision', () => {
    expect(parseConsent('1:all')).toEqual({ version: 1, analytics: true });
  });

  it('parses a "necessary" decision', () => {
    expect(parseConsent('1:necessary')).toEqual({
      version: 1,
      analytics: false,
    });
  });

  it('returns null for empty, non-numeric version, or unknown choice', () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('x:all')).toBeNull();
    expect(parseConsent('1:bogus')).toBeNull();
  });
});

describe('analyticsGranted', () => {
  it('is true only for the current version + all', () => {
    expect(analyticsGranted(serializeConsent(true))).toBe(true);
  });

  it('is false when only necessary was chosen', () => {
    expect(analyticsGranted(serializeConsent(false))).toBe(false);
  });

  it('is false for a stale policy version', () => {
    expect(analyticsGranted('0:all')).toBe(false);
  });

  it('is false when no decision is stored', () => {
    expect(analyticsGranted(null)).toBe(false);
  });
});

describe('serializeConsent', () => {
  it('encodes the current version and choice', () => {
    expect(serializeConsent(true)).toBe(`${CONSENT_POLICY_VERSION}:all`);
    expect(serializeConsent(false)).toBe(`${CONSENT_POLICY_VERSION}:necessary`);
  });
});
