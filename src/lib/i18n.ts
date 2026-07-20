export const LANGS = ['ro', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LOCALE: Lang = 'ro';

export function isLang(v: string | undefined): v is Lang {
  return v === 'ro' || v === 'ru';
}

export function otherLang(l: Lang): Lang {
  return l === 'ro' ? 'ru' : 'ro';
}

// Prefix a path with the locale (indexable pages live under /[lang]/...).
export function localePath(lang: Lang, path = ''): string {
  const clean = path.replace(/^\/+/, '');
  return clean ? `/${lang}/${clean}` : `/${lang}`;
}

// Current locale from a pathname's first segment (for shared components that
// render outside the [lang] route param, e.g. Header). Falls back to default.
export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/').filter(Boolean)[0];
  return isLang(seg) ? seg : DEFAULT_LOCALE;
}

export interface Alternate {
  lang: string;
  path: string;
}

// Build hreflang alternates for a page that exists in every locale (home,
// search): one entry per locale plus x-default → the default locale.
export function hreflangAlternates(
  pathByLang: (lang: Lang) => string,
): Alternate[] {
  return [
    ...LANGS.map((l) => ({ lang: l, path: pathByLang(l) })),
    { lang: 'x-default', path: pathByLang(DEFAULT_LOCALE) },
  ];
}
