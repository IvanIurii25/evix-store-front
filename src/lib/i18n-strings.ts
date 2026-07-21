import type { Lang } from './i18n';

// UI strings for the homepage. Product/category names come localized from the
// API; these are the static chrome strings (hero, section titles, benefits).
export interface HomeStrings {
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  categoriesTitle: string;
  popularTitle: string;
  newestTitle: string;
  dealsTitle: string;
  benefits: { title: string; text: string }[];
}

const HOME: Record<Lang, HomeStrings> = {
  ro: {
    heroTitle: 'Cumpărături inteligente, livrare rapidă',
    heroSubtitle:
      'Mii de produse la prețuri bune. Plata la primire, ridicare gratuită.',
    heroCta: 'Vezi catalogul',
    categoriesTitle: 'Categorii',
    popularTitle: 'Populare',
    newestTitle: 'Noutăți',
    dealsTitle: 'Reduceri',
    benefits: [
      { title: 'Plata la primire', text: 'Achiți când primești comanda' },
      { title: 'Ridicare gratuită', text: 'Din punctul nostru de ridicare' },
      { title: 'Livrare prin curier', text: 'În oraș, tarif fix' },
      { title: 'Produse originale', text: 'Calitate garantată' },
    ],
  },
  ru: {
    heroTitle: 'Умные покупки, быстрая доставка',
    heroSubtitle:
      'Тысячи товаров по выгодным ценам. Оплата при получении, самовывоз бесплатно.',
    heroCta: 'В каталог',
    categoriesTitle: 'Категории',
    popularTitle: 'Популярные',
    newestTitle: 'Новинки',
    dealsTitle: 'Скидки',
    benefits: [
      { title: 'Оплата при получении', text: 'Платите, когда получаете заказ' },
      { title: 'Самовывоз бесплатно', text: 'Из нашего пункта выдачи' },
      { title: 'Доставка курьером', text: 'По городу, фиксированный тариф' },
      { title: 'Оригинальный товар', text: 'Гарантия качества' },
    ],
  },
};

export function homeStrings(lang: Lang): HomeStrings {
  return HOME[lang];
}

// Shared storefront chrome strings (header, product card, search island).
export interface UiStrings {
  catalog: string;
  account: string;
  login: string;
  cart: string;
  language: string;
  searchPlaceholder: string;
  searchAllResults: string;
  inStock: string;
  outOfStock: string;
  addToCart: string;
  noPhoto: string;
  saleBadge: string;
}

const UI: Record<Lang, UiStrings> = {
  ro: {
    catalog: 'Catalog',
    account: 'Cont',
    login: 'Autentificare',
    cart: 'Coș',
    language: 'Limbă',
    searchPlaceholder: 'Caută produse…',
    searchAllResults: 'Toate rezultatele →',
    inStock: 'În stoc',
    outOfStock: 'Stoc epuizat',
    addToCart: 'Adaugă în coș',
    noPhoto: 'fără foto',
    saleBadge: 'Reducere',
  },
  ru: {
    catalog: 'Каталог',
    account: 'Кабинет',
    login: 'Войти',
    cart: 'Корзина',
    language: 'Язык',
    searchPlaceholder: 'Поиск товаров…',
    searchAllResults: 'Все результаты →',
    inStock: 'В наличии',
    outOfStock: 'Нет в наличии',
    addToCart: 'В корзину',
    noPhoto: 'нет фото',
    saleBadge: 'Скидка',
  },
};

export function ui(lang: Lang): UiStrings {
  return UI[lang];
}
