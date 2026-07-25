// schema.org (JSON-LD) builders for structured data. Kept framework-agnostic:
// pages pass the request origin (from `Astro.site`) so emitted URLs are absolute.
import type { Lang } from './i18n';
import { localePath } from './i18n';

export type JsonLd = Record<string, unknown>;

interface Crumb {
  name: string;
  slug: string;
}

interface ProductLike {
  name: string;
  code: string;
  price: string | number;
  in_stock: boolean;
  description?: string | null;
  seo_description?: string | null;
  media?: { url: string }[] | null;
  // Real approved-review aggregate (from ProductDetail). Emitted as
  // schema.org AggregateRating only when there is at least one review, so the
  // structured data always reflects what the page actually shows (Google
  // policy — no fabricated ratings).
  rating_avg?: number | null;
  rating_count?: number | null;
}

const abs = (origin: string, path: string): string =>
  new URL(path, origin).href;

// BreadcrumbList from the home root through category ancestors to the current
// page. `current.path` is the page's own canonical path.
export function breadcrumbJsonLd(
  origin: string,
  lang: Lang,
  crumbs: Crumb[],
  current: { name: string; path: string },
): JsonLd {
  const trail = [
    { name: 'evix-store', path: localePath(lang) },
    ...crumbs.map((c) => ({
      name: c.name,
      path: localePath(lang, `c/${c.slug}`),
    })),
    { name: current.name, path: current.path },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: abs(origin, item.path),
    })),
  };
}

// Product with a single Offer (MDL, COD). Availability maps stock to schema.org.
export function productJsonLd(
  origin: string,
  canonicalPath: string,
  product: ProductLike,
): JsonLd {
  const description = product.description ?? product.seo_description;
  const images = (product.media ?? []).map((m) => abs(origin, m.url));
  const ratingCount = product.rating_count ?? 0;
  const hasRating =
    ratingCount > 0 &&
    product.rating_avg != null &&
    Number.isFinite(product.rating_avg);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.code,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating_avg,
            reviewCount: ratingCount,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url: abs(origin, canonicalPath),
      priceCurrency: 'MDL',
      price: String(product.price),
      availability: product.in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };
}

// Organization: brand identity for the knowledge panel / rich results. Emit once
// (homepage). `logo` points at the site icon (an absolute URL is required).
export function organizationJsonLd(origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'evix',
    url: origin,
    logo: abs(origin, '/favicon.svg'),
  };
}

// WebSite + SearchAction: lets Google render a sitelinks search box that points
// at the storefront's own search. The `{search_term_string}` placeholder must
// stay un-encoded, so the query is concatenated rather than built via URL.
export function websiteJsonLd(origin: string, lang: Lang): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'evix',
    url: origin,
    inLanguage: lang,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${abs(origin, localePath(lang, 'search'))}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
