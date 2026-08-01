import { api } from './client';
import type { components } from '../types/api';

// Site-wide SEO defaults (public, read-only) — see backend app/api/routers/site.py.
export type SeoDefaults = components['schemas']['SeoSettings'];

// Fully-formed empty block: the storefront always gets a usable object, even if
// the backend is unreachable, so meta composition never throws.
const EMPTY_SEO: SeoDefaults = {
  title_ru: '',
  title_ro: '',
  description_ru: '',
  description_ro: '',
  title_suffix: '',
  og_image_url: '',
};

// --- Public runtime config (feature flags) ----------------------------------
export type SiteConfig = components['schemas']['SiteConfigOut'];

// Card payment is gated server-side by env creds. When the config endpoint is
// unreachable we fail closed (card hidden) so the storefront never offers an
// option the backend would reject.
const CONFIG_DISABLED: SiteConfig = { card_payment_enabled: false };

// Public storefront runtime config. Read at checkout SSR to decide whether to
// render the card-payment option. Degrades to card-disabled on any failure.
export async function getSiteConfig(): Promise<SiteConfig> {
  const { data, error } = await api.GET('/api/v1/site/config');
  if (error || !data) return CONFIG_DISABLED;
  return data;
}

// SEO defaults change rarely (a back-office edit), but Layout reads them on every
// SSR page render — cache them process-wide with a short TTL so we hit the API at
// most once per window instead of once per pageview.
const TTL_MS = 5 * 60 * 1000;
let cache: { value: SeoDefaults; expiresAt: number } | null = null;

export async function getSeoDefaults(): Promise<SeoDefaults> {
  const { data, error } = await api.GET('/api/v1/site/seo');
  if (error || !data) return EMPTY_SEO;
  return data;
}

// Cached accessor for SSR. On fetch failure returns the (uncached) empty block so
// a transient backend hiccup degrades to bare defaults rather than a broken page.
export async function loadSeoDefaults(now = Date.now()): Promise<SeoDefaults> {
  if (cache && cache.expiresAt > now) return cache.value;
  const value = await getSeoDefaults();
  if (value !== EMPTY_SEO) cache = { value, expiresAt: now + TTL_MS };
  return value;
}

// --- Content pages (info/legal, manager-editable) ---------------------------
export type ContentPageListItem = components['schemas']['ContentPageListItem'];
export type ContentPageDetail = components['schemas']['ContentPageDetail'];

// Published footer pages change rarely — cache per-lang like the SEO defaults so
// the footer (rendered on every SSR page) hits the API at most once per window.
const footerCache = new Map<
  string,
  { value: ContentPageListItem[]; expiresAt: number }
>();

// Published, footer-visible pages for the given language (for the site footer).
// Returns [] on any failure so the footer degrades to its static links.
export async function loadFooterPages(
  lang: string,
  now = Date.now(),
): Promise<ContentPageListItem[]> {
  const hit = footerCache.get(lang);
  if (hit && hit.expiresAt > now) return hit.value;
  const { data, error } = await api.GET('/api/v1/site/pages', {
    params: { query: { lang } },
  });
  const value = error || !data ? [] : data;
  if (!error && data) footerCache.set(lang, { value, expiresAt: now + TTL_MS });
  return value;
}

// --- Homepage banners (carousel) --------------------------------------------
export type Banner = components['schemas']['BannerOut'];

// Banners are read on every homepage render, so they are cached per-lang — but
// on a much shorter window than the SEO defaults or footer pages. Those change
// once a quarter; a banner is swapped during a campaign, by someone who is
// looking at the homepage to check their work. A minute of staleness is
// forgivable, five is the manager reloading and concluding it is broken. The
// cost of the shorter window is one request per minute per language.
const BANNER_TTL_MS = 60 * 1000;
const bannerCache = new Map<string, { value: Banner[]; expiresAt: number }>();

// The live carousel for the language. Returns [] on any failure and does not
// cache it, so the homepage falls back to its static hero on a hiccup and
// retries on the next render instead of staying empty for the whole window.
export async function loadBanners(
  lang: string,
  now = Date.now(),
): Promise<Banner[]> {
  const hit = bannerCache.get(lang);
  if (hit && hit.expiresAt > now) return hit.value;
  const { data, error } = await api.GET('/api/v1/site/banners', {
    params: { query: { lang } },
  });
  if (error || !data) return [];
  bannerCache.set(lang, { value: data, expiresAt: now + BANNER_TTL_MS });
  return data;
}

// One published content page for the language, or null (unknown/unpublished/404).
export async function getContentPage(
  slug: string,
  lang: string,
): Promise<ContentPageDetail | null> {
  const { data, error } = await api.GET('/api/v1/site/pages/{slug}', {
    params: { path: { slug }, query: { lang } },
  });
  if (error || !data) return null;
  return data;
}

export interface MetaInput {
  lang: string;
  // Page-specific title; when omitted the site title is used as-is (homepage).
  title?: string;
  // Page-specific description; falls back to the site default.
  description?: string;
  // Page-specific OG image; falls back to the site default OG image.
  ogImage?: string;
}

export interface ResolvedMeta {
  title: string;
  description: string;
  ogImage: string;
}

// Pure composition of the final page meta from the site-wide defaults + the
// page's own overrides. A page title gets the configured suffix ("Товар — evix");
// the homepage (no title) uses the site title as-is. Bare fallbacks keep meta
// well-formed when the defaults are unset.
export function resolveSeoMeta(
  seo: SeoDefaults,
  input: MetaInput,
): ResolvedMeta {
  const langKey = input.lang === 'ru' ? 'ru' : 'ro';
  const siteTitle = seo[`title_${langKey}`] || 'evix-store';
  const siteDescription =
    seo[`description_${langKey}`] || 'evix-store storefront';
  return {
    title: input.title ? `${input.title}${seo.title_suffix}` : siteTitle,
    description: input.description || siteDescription,
    ogImage: input.ogImage || seo.og_image_url || '/og-default.png',
  };
}
