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

// --- Transactional pages (cart / checkout / auth / account) ---------------- //

export interface CartStrings {
  title: string;
  loading: string;
  empty: string;
  toCatalog: string;
  perUnit: string;
  remove: string;
  total: string;
  checkout: string;
}

const CART: Record<Lang, CartStrings> = {
  ro: {
    title: 'Coș',
    loading: 'Se încarcă…',
    empty: 'Coșul este gol.',
    toCatalog: 'Spre catalog →',
    perUnit: '/ buc',
    remove: 'Elimină',
    total: 'Total',
    checkout: 'Finalizează comanda',
  },
  ru: {
    title: 'Корзина',
    loading: 'Загрузка…',
    empty: 'Корзина пуста.',
    toCatalog: 'В каталог →',
    perUnit: '/ шт',
    remove: 'Удалить',
    total: 'Итого',
    checkout: 'Оформить заказ',
  },
};

export function cartStrings(lang: Lang): CartStrings {
  return CART[lang];
}

export interface CheckoutStrings {
  pageTitle: string;
  contacts: string;
  phone: string;
  delivery: string;
  pickup: string;
  courier: string;
  recipientName: string;
  city: string;
  street: string;
  zipOptional: string;
  savedAddresses: string;
  useAnotherAddress: string;
  payment: string;
  paymentInfo: string;
  consent: string;
  yourOrder: string;
  items: string;
  free: string;
  quoteUnavailable: string;
  placeOrder: string;
  errAddress: string;
  errEmail: string;
  errPhone: string;
  errConsent: string;
  errCalc: string;
  errGeneric: string;
  // success page
  successTitle: string;
  orderPlacedPre: string;
  orderPlacedPost: string;
  willContactPre: string;
  willContactPost: string;
  paymentCod: string;
  pickupShort: string;
  courierShort: string;
  address: string;
  total: string;
  toCatalog: string;
  createAccount: string;
  notFoundPre: string;
  backToCatalog: string;
}

const CHECKOUT: Record<Lang, CheckoutStrings> = {
  ro: {
    pageTitle: 'Finalizarea comenzii',
    contacts: 'Contacte',
    phone: 'Telefon',
    delivery: 'Livrare',
    pickup: 'Ridicare personală (gratuit)',
    courier: 'Curier',
    recipientName: 'Numele destinatarului',
    city: 'Oraș',
    street: 'Strada, casa, apartament',
    zipOptional: 'Cod poștal (opțional)',
    savedAddresses: 'Adrese salvate',
    useAnotherAddress: 'Introduceți altă adresă',
    payment: 'Plata',
    paymentInfo:
      'Plata la primire (numerar sau card curierului / la punctul de ridicare).',
    consent: 'Sunt de acord cu condițiile de plasare a comenzii',
    yourOrder: 'Comanda ta',
    items: 'Produse',
    free: 'gratuit',
    quoteUnavailable: 'Calcul indisponibil.',
    placeOrder: 'Finalizează comanda',
    errAddress: 'Indicați adresa de livrare (nume, oraș, stradă).',
    errEmail: 'Introduceți un email valid',
    errPhone: 'Introduceți telefonul',
    errConsent: 'Confirmați acordul cu condițiile',
    errCalc: 'Calcul indisponibil',
    errGeneric: 'Eroare',
    successTitle: 'Comandă plasată',
    orderPlacedPre: 'Comanda',
    orderPlacedPost: 'a fost plasată',
    willContactPre: 'Vă vom contacta la telefonul',
    willContactPost: 'pentru confirmare.',
    paymentCod: 'La primire (COD)',
    pickupShort: 'Ridicare personală',
    courierShort: 'Curier',
    address: 'Adresă',
    total: 'Total',
    toCatalog: 'Spre catalog',
    createAccount: 'Creează cont',
    notFoundPre: 'Comanda nu a fost găsită. Verificați linkul sau',
    backToCatalog: 'reveniți la catalog',
  },
  ru: {
    pageTitle: 'Оформление заказа',
    contacts: 'Контакты',
    phone: 'Телефон',
    delivery: 'Доставка',
    pickup: 'Самовывоз (бесплатно)',
    courier: 'Курьер',
    recipientName: 'Имя получателя',
    city: 'Город',
    street: 'Улица, дом, квартира',
    zipOptional: 'Индекс (необязательно)',
    savedAddresses: 'Сохранённые адреса',
    useAnotherAddress: 'Ввести другой адрес',
    payment: 'Оплата',
    paymentInfo:
      'Оплата при получении (наличными или картой курьеру / в пункте выдачи).',
    consent: 'Согласен с условиями оформления заказа',
    yourOrder: 'Ваш заказ',
    items: 'Товары',
    free: 'бесплатно',
    quoteUnavailable: 'Расчёт недоступен.',
    placeOrder: 'Оформить заказ',
    errAddress: 'Укажите адрес доставки (имя, город, улица).',
    errEmail: 'Введите корректный email',
    errPhone: 'Введите телефон',
    errConsent: 'Подтвердите согласие с условиями',
    errCalc: 'Расчёт недоступен',
    errGeneric: 'Ошибка',
    successTitle: 'Заказ оформлен',
    orderPlacedPre: 'Заказ',
    orderPlacedPost: 'оформлен',
    willContactPre: 'Мы свяжемся с вами по телефону',
    willContactPost: 'для подтверждения.',
    paymentCod: 'При получении (COD)',
    pickupShort: 'Самовывоз',
    courierShort: 'Курьер',
    address: 'Адрес',
    total: 'Итого',
    toCatalog: 'В каталог',
    createAccount: 'Создать аккаунт',
    notFoundPre: 'Заказ не найден. Проверьте ссылку или',
    backToCatalog: 'вернитесь в каталог',
  },
};

export function checkoutStrings(lang: Lang): CheckoutStrings {
  return CHECKOUT[lang];
}

export interface AuthStrings {
  pageTitle: string;
  login: string;
  register: string;
  emailOrPhone: string;
  phoneOptional: string;
  password: string;
  signIn: string;
  signUp: string;
  errPasswordMin: string;
  errEmail: string;
  errGeneric: string;
}

const AUTH: Record<Lang, AuthStrings> = {
  ro: {
    pageTitle: 'Autentificare',
    login: 'Autentificare',
    register: 'Înregistrare',
    emailOrPhone: 'Email sau telefon',
    phoneOptional: 'Telefon (opțional)',
    password: 'Parolă',
    signIn: 'Intră',
    signUp: 'Înregistrează-te',
    errPasswordMin: 'Parola — minimum 6 caractere',
    errEmail: 'Introduceți un email valid',
    errGeneric: 'Eroare',
  },
  ru: {
    pageTitle: 'Вход в аккаунт',
    login: 'Вход',
    register: 'Регистрация',
    emailOrPhone: 'Email или телефон',
    phoneOptional: 'Телефон (необязательно)',
    password: 'Пароль',
    signIn: 'Войти',
    signUp: 'Зарегистрироваться',
    errPasswordMin: 'Пароль — минимум 6 символов',
    errEmail: 'Введите корректный email',
    errGeneric: 'Ошибка',
  },
};

export function authStrings(lang: Lang): AuthStrings {
  return AUTH[lang];
}

export interface AccountStrings {
  pageTitle: string;
  profile: string;
  phone: string;
  deliveryAddresses: string;
  orderHistory: string;
  logout: string;
  loading: string;
  addrDefault: string;
  addrMakeDefault: string;
  addrRemove: string;
  addrNone: string;
  addrRecipient: string;
  addrCity: string;
  addrStreet: string;
  addrZip: string;
  addrSave: string;
  addrAdd: string;
  ordNone: string;
  ordOrder: string;
  statusNew: string;
  statusConfirmed: string;
  statusDone: string;
  statusCanceled: string;
  paid: string;
  awaitingPayment: string;
}

const ACCOUNT: Record<Lang, AccountStrings> = {
  ro: {
    pageTitle: 'Cont',
    profile: 'Profil',
    phone: 'Telefon',
    deliveryAddresses: 'Adrese de livrare',
    orderHistory: 'Istoricul comenzilor',
    logout: 'Ieși',
    loading: 'Se încarcă…',
    addrDefault: 'implicit',
    addrMakeDefault: 'Setează ca principal',
    addrRemove: 'Elimină',
    addrNone: 'Nu există adrese încă.',
    addrRecipient: 'Destinatar',
    addrCity: 'Oraș',
    addrStreet: 'Strada, casa',
    addrZip: 'Cod poștal (opț.)',
    addrSave: 'Salvează',
    addrAdd: '+ Adaugă adresă',
    ordNone: 'Nu există comenzi încă.',
    ordOrder: 'Comanda',
    statusNew: 'Nouă',
    statusConfirmed: 'Confirmată',
    statusDone: 'Finalizată',
    statusCanceled: 'Anulată',
    paid: 'achitat',
    awaitingPayment: 'în așteptarea plății',
  },
  ru: {
    pageTitle: 'Кабинет',
    profile: 'Профиль',
    phone: 'Телефон',
    deliveryAddresses: 'Адреса доставки',
    orderHistory: 'История заказов',
    logout: 'Выйти',
    loading: 'Загрузка…',
    addrDefault: 'по умолчанию',
    addrMakeDefault: 'Сделать основным',
    addrRemove: 'Удалить',
    addrNone: 'Адресов пока нет.',
    addrRecipient: 'Получатель',
    addrCity: 'Город',
    addrStreet: 'Улица, дом',
    addrZip: 'Индекс (опц.)',
    addrSave: 'Сохранить',
    addrAdd: '+ Добавить адрес',
    ordNone: 'Заказов пока нет.',
    ordOrder: 'Заказ',
    statusNew: 'Новый',
    statusConfirmed: 'Подтверждён',
    statusDone: 'Выполнен',
    statusCanceled: 'Отменён',
    paid: 'оплачен',
    awaitingPayment: 'ожидает оплаты',
  },
};

export function accountStrings(lang: Lang): AccountStrings {
  return ACCOUNT[lang];
}

export interface FooterLabels {
  shopTitle: string;
  catalog: string;
  infoTitle: string;
}

const FOOTER_LABELS: Record<Lang, FooterLabels> = {
  ro: { shopTitle: 'Magazin', catalog: 'Catalog', infoTitle: 'Informații' },
  ru: { shopTitle: 'Магазин', catalog: 'Каталог', infoTitle: 'Информация' },
};

export function footerLabels(lang: Lang): FooterLabels {
  return FOOTER_LABELS[lang];
}

export interface ConsentStrings {
  message: string;
  acceptAll: string;
  onlyNecessary: string;
  moreLink: string;
  settings: string;
}

const CONSENT_STRINGS: Record<Lang, ConsentStrings> = {
  ro: {
    message:
      'Folosim cookie-uri necesare și, cu acordul dvs., cookie-uri proprii de analiză pentru a înțelege traficul. Nu folosim urmăritori terți.',
    acceptAll: 'Accept toate',
    onlyNecessary: 'Doar necesare',
    moreLink: 'Politica de confidențialitate',
    settings: 'Setări cookie',
  },
  ru: {
    message:
      'Мы используем необходимые cookie и, с вашего согласия, собственные аналитические cookie для оценки трафика. Сторонних трекеров нет.',
    acceptAll: 'Принять все',
    onlyNecessary: 'Только необходимые',
    moreLink: 'Политика конфиденциальности',
    settings: 'Настройки cookie',
  },
};

export function consentStrings(lang: Lang): ConsentStrings {
  return CONSENT_STRINGS[lang];
}
