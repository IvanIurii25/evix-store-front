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
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.code,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
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
