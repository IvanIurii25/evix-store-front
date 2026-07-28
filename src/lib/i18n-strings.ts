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
  loadError: string;
  retry: string;
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
    loadError: 'Nu s-a putut încărca coșul.',
    retry: 'Reîncearcă',
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
    loadError: 'Не удалось загрузить корзину.',
    retry: 'Повторить',
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
  // payment method selector
  payMethodCod: string;
  payMethodCard: string;
  payCardInfo: string;
  errPayRedirect: string;
  consent: string;
  yourOrder: string;
  items: string;
  free: string;
  quoteUnavailable: string;
  placeOrder: string;
  // promo code
  promoCode: string;
  promoPlaceholder: string;
  promoApply: string;
  promoRemove: string;
  promoApplied: string;
  discount: string;
  promoErrInvalid: string;
  promoErrExpired: string;
  promoErrMinOrder: string;
  promoErrUsageLimit: string;
  promoErrGeneric: string;
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
  // payment-failed page (maib return)
  failTitle: string;
  failHeading: string;
  failText: string;
  failOrderPre: string;
  tryAgain: string;
  toCart: string;
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
    payMethodCod: 'Numerar la primire (COD)',
    payMethodCard: 'Card online',
    payCardInfo: 'Veți fi redirecționat spre pagina securizată de plată maib.',
    errPayRedirect:
      'Nu s-a putut iniția plata cu cardul. Încercați din nou sau alegeți plata la primire.',
    consent: 'Sunt de acord cu condițiile de plasare a comenzii',
    yourOrder: 'Comanda ta',
    items: 'Produse',
    free: 'gratuit',
    quoteUnavailable: 'Calcul indisponibil.',
    placeOrder: 'Finalizează comanda',
    promoCode: 'Cod promoțional',
    promoPlaceholder: 'Introduceți codul',
    promoApply: 'Aplică',
    promoRemove: 'Elimină',
    promoApplied: 'Cod aplicat',
    discount: 'Reducere',
    promoErrInvalid: 'Cod promoțional invalid.',
    promoErrExpired: 'Codul promoțional a expirat.',
    promoErrMinOrder: 'Comanda nu atinge suma minimă pentru acest cod.',
    promoErrUsageLimit: 'Limita de utilizări a codului a fost atinsă.',
    promoErrGeneric: 'Nu s-a putut aplica codul.',
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
    failTitle: 'Plata nu a reușit',
    failHeading: 'Plata nu a fost efectuată',
    failText:
      'Plata nu a trecut sau comanda a fost anulată. Puteți încerca din nou.',
    failOrderPre: 'Comanda',
    tryAgain: 'Încercați din nou',
    toCart: 'Spre coș',
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
    payMethodCod: 'Наличными при получении (COD)',
    payMethodCard: 'Картой онлайн',
    payCardInfo: 'Вы будете перенаправлены на защищённую страницу оплаты maib.',
    errPayRedirect:
      'Не удалось начать оплату картой. Попробуйте снова или выберите оплату при получении.',
    consent: 'Согласен с условиями оформления заказа',
    yourOrder: 'Ваш заказ',
    items: 'Товары',
    free: 'бесплатно',
    quoteUnavailable: 'Расчёт недоступен.',
    placeOrder: 'Оформить заказ',
    promoCode: 'Промокод',
    promoPlaceholder: 'Введите код',
    promoApply: 'Применить',
    promoRemove: 'Убрать',
    promoApplied: 'Код применён',
    discount: 'Скидка',
    promoErrInvalid: 'Неверный промокод.',
    promoErrExpired: 'Срок действия промокода истёк.',
    promoErrMinOrder: 'Заказ не достигает минимальной суммы для этого кода.',
    promoErrUsageLimit: 'Достигнут лимит использований кода.',
    promoErrGeneric: 'Не удалось применить код.',
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
    failTitle: 'Оплата не прошла',
    failHeading: 'Оплата не была выполнена',
    failText:
      'Оплата не прошла или заказ был отменён. Вы можете попробовать снова.',
    failOrderPre: 'Заказ',
    tryAgain: 'Попробовать снова',
    toCart: 'В корзину',
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
  deleteAccount: string;
  deleteWarning: string;
  deleteConfirm: string;
  deleteCancel: string;
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
    deleteAccount: 'Șterge contul',
    deleteWarning:
      'Contul și datele personale vor fi șterse ireversibil. Comenzile se păstrează conform obligațiilor fiscale.',
    deleteConfirm: 'Confirmă ștergerea',
    deleteCancel: 'Anulează',
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
    deleteAccount: 'Удалить аккаунт',
    deleteWarning:
      'Аккаунт и персональные данные будут удалены безвозвратно. Заказы сохраняются согласно налоговым обязательствам.',
    deleteConfirm: 'Подтвердить удаление',
    deleteCancel: 'Отмена',
  },
};

export function accountStrings(lang: Lang): AccountStrings {
  return ACCOUNT[lang];
}

export interface FooterLabels {
  shopTitle: string;
  catalog: string;
  infoTitle: string;
  support: string;
}

const FOOTER_LABELS: Record<Lang, FooterLabels> = {
  ro: {
    shopTitle: 'Magazin',
    catalog: 'Catalog',
    infoTitle: 'Informații',
    support: 'Scrieți la suport',
  },
  ru: {
    shopTitle: 'Магазин',
    catalog: 'Каталог',
    infoTitle: 'Информация',
    support: 'Написать в поддержку',
  },
};

export function footerLabels(lang: Lang): FooterLabels {
  return FOOTER_LABELS[lang];
}

// --- Catalog listing / category page chrome -------------------------------- //

export interface ListingStrings {
  breadcrumbHome: string;
  priceFilter: string;
  priceFrom: string;
  priceTo: string;
  apply: string;
  loadMore: string;
  loading: string;
  emptyCategory: string;
  sortNewest: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
  loadError: string;
  retry: string;
}

const LISTING: Record<Lang, ListingStrings> = {
  ro: {
    breadcrumbHome: 'Acasă',
    priceFilter: 'Preț, MDL',
    priceFrom: 'de la',
    priceTo: 'până la',
    apply: 'Aplică',
    loadMore: 'Arată mai multe',
    loading: 'Se încarcă…',
    emptyCategory: 'În această categorie nu există produse încă.',
    sortNewest: 'Cele mai noi',
    sortPriceAsc: 'Preț crescător',
    sortPriceDesc: 'Preț descrescător',
    loadError: 'Nu s-au putut încărca produsele.',
    retry: 'Reîncearcă',
  },
  ru: {
    breadcrumbHome: 'Главная',
    priceFilter: 'Цена, MDL',
    priceFrom: 'от',
    priceTo: 'до',
    apply: 'Применить',
    loadMore: 'Показать ещё',
    loading: 'Загрузка…',
    emptyCategory: 'В этой категории пока нет товаров.',
    sortNewest: 'Сначала новые',
    sortPriceAsc: 'Сначала дешёвые',
    sortPriceDesc: 'Сначала дорогие',
    loadError: 'Не удалось загрузить товары.',
    retry: 'Повторить',
  },
};

export function listingStrings(lang: Lang): ListingStrings {
  return LISTING[lang];
}

// --- Product detail page (PDP) chrome -------------------------------------- //

export interface PdpStrings {
  code: string;
  addedToCart: string;
  addToCartError: string;
  tabDescription: string;
  tabAttributes: string;
  relatedTitle: string;
  // Honest social-proof badge prefix; followed by personCount(n, lang).
  // RO → "🛒 În coșul a {N persoane}", RU → "🛒 В корзине у {N человек}".
  inCartPrefix: string;
  // Indicative installment line (NOT a real BNPL). "Rate de la ~{monthly} ..."
  // installmentPrefix + monthly amount + installmentSuffix ("lei/lună").
  installmentPrefix: string;
  installmentSuffix: string;
  installmentNote: string; // small honesty note ("orientativ" / "оценочно")
  installmentDetails: string; // optional "Detalii" / "Подробнее" link label
  // Variable products: "from" price prefix, per-attribute picker prompt, and the
  // hint shown until a full combination is chosen.
  priceFrom: string;
  chooseOption: string; // "Alegeți" / "Выберите" — followed by the attribute name
  selectToBuy: string; // "Alegeți opțiunile" / "Выберите характеристики"
}

const PDP: Record<Lang, PdpStrings> = {
  ro: {
    code: 'Cod:',
    addedToCart: 'Adăugat ✓',
    addToCartError: 'Nu s-a putut adăuga în coș',
    tabDescription: 'Descriere',
    tabAttributes: 'Specificații',
    relatedTitle: 'Produse similare',
    inCartPrefix: '🛒 În coșul a',
    installmentPrefix: 'Rate de la ~',
    installmentSuffix: 'lei/lună',
    installmentNote: 'orientativ',
    installmentDetails: 'Detalii',
    priceFrom: 'de la',
    chooseOption: 'Alegeți',
    selectToBuy: 'Alegeți opțiunile',
  },
  ru: {
    code: 'Код:',
    addedToCart: 'Добавлено ✓',
    addToCartError: 'Не удалось добавить в корзину',
    tabDescription: 'Описание',
    tabAttributes: 'Характеристики',
    relatedTitle: 'Похожие товары',
    inCartPrefix: '🛒 В корзине у',
    installmentPrefix: 'Рассрочка от ~',
    installmentSuffix: 'лей/мес',
    installmentNote: 'оценочно',
    installmentDetails: 'Подробнее',
    priceFrom: 'от',
    chooseOption: 'Выберите',
    selectToBuy: 'Выберите характеристики',
  },
};

export function pdpStrings(lang: Lang): PdpStrings {
  return PDP[lang];
}

// --- Reviews & ratings (PDP section + rating summary) ---------------------- //

export interface ReviewStrings {
  sectionTitle: string; // "Отзывы" / "Recenzii" (count appended by caller)
  noReviews: string; // empty state under the aggregate
  loadError: string; // list fetch failed
  retry: string; // retry button
  verifiedBadge: string; // "✓ Проверенная покупка" / "✓ Achiziție verificată"
  anonymous: string; // author fallback — "Покупатель" / "Client"
  // Sort control
  sortLabel: string;
  sortNewest: string;
  sortHighest: string;
  sortLowest: string;
  loadMore: string; // "Показать ещё" / "Arată mai multe"
  // "Leave a review" CTA + form
  leaveReview: string;
  yourRating: string; // star-picker label
  ratingRequired: string; // client-side: no star chosen
  titlePlaceholder: string;
  bodyPlaceholder: string;
  namePlaceholder: string;
  submit: string;
  submitting: string;
  submitted: string; // "Отзыв отправлен на модерацию"
  submitError: string;
  cancel: string;
  edit: string;
  save: string;
  remove: string;
  removeConfirm: string;
  // "Your review" panel + statuses
  yourReview: string;
  statusPending: string; // "на проверке" / "în verificare"
  statusRejected: string; // "отклонён" / "respinsă"
  statusApproved: string; // "опубликован" / "publicată"
}

const REVIEWS: Record<Lang, ReviewStrings> = {
  ro: {
    sectionTitle: 'Recenzii',
    noReviews: 'Încă nu există recenzii. Fii primul care lasă una.',
    loadError: 'Nu s-au putut încărca recenziile.',
    retry: 'Reîncearcă',
    verifiedBadge: '✓ Achiziție verificată',
    anonymous: 'Client',
    sortLabel: 'Sortează',
    sortNewest: 'Cele mai noi',
    sortHighest: 'Notă mare',
    sortLowest: 'Notă mică',
    loadMore: 'Arată mai multe',
    leaveReview: 'Lasă o recenzie',
    yourRating: 'Nota ta',
    ratingRequired: 'Alege o notă',
    titlePlaceholder: 'Titlu (opțional)',
    bodyPlaceholder: 'Părerea ta despre produs (opțional)',
    namePlaceholder: 'Numele tău (opțional)',
    submit: 'Trimite recenzia',
    submitting: 'Se trimite…',
    submitted: 'Recenzia a fost trimisă spre moderare',
    submitError: 'Nu s-a putut trimite recenzia',
    cancel: 'Anulează',
    edit: 'Editează',
    save: 'Salvează',
    remove: 'Șterge',
    removeConfirm: 'Ștergi recenzia ta?',
    yourReview: 'Recenzia ta',
    statusPending: 'în verificare',
    statusRejected: 'respinsă',
    statusApproved: 'publicată',
  },
  ru: {
    sectionTitle: 'Отзывы',
    noReviews: 'Отзывов пока нет. Будьте первым, кто оставит отзыв.',
    loadError: 'Не удалось загрузить отзывы.',
    retry: 'Повторить',
    verifiedBadge: '✓ Проверенная покупка',
    anonymous: 'Покупатель',
    sortLabel: 'Сортировка',
    sortNewest: 'Сначала новые',
    sortHighest: 'Высокая оценка',
    sortLowest: 'Низкая оценка',
    loadMore: 'Показать ещё',
    leaveReview: 'Оставить отзыв',
    yourRating: 'Ваша оценка',
    ratingRequired: 'Выберите оценку',
    titlePlaceholder: 'Заголовок (необязательно)',
    bodyPlaceholder: 'Ваше мнение о товаре (необязательно)',
    namePlaceholder: 'Ваше имя (необязательно)',
    submit: 'Отправить отзыв',
    submitting: 'Отправка…',
    submitted: 'Отзыв отправлен на модерацию',
    submitError: 'Не удалось отправить отзыв',
    cancel: 'Отмена',
    edit: 'Изменить',
    save: 'Сохранить',
    remove: 'Удалить',
    removeConfirm: 'Удалить ваш отзыв?',
    yourReview: 'Ваш отзыв',
    statusPending: 'на проверке',
    statusRejected: 'отклонён',
    statusApproved: 'опубликован',
  },
};

export function reviewStrings(lang: Lang): ReviewStrings {
  return REVIEWS[lang];
}

// --- Social share block ("Distribuie" / "Поделиться") ---------------------- //

export interface ShareStrings {
  title: string; // block heading
  facebook: string; // aria-labels / tooltips for each network
  telegram: string;
  whatsapp: string;
  viber: string;
  copy: string; // "Copiază linkul" / "Копировать ссылку"
  copied: string; // toast after successful copy — "Copiat ✓" / "Скопировано ✓"
  copyFailed: string; // fallback when clipboard is unavailable
}

const SHARE: Record<Lang, ShareStrings> = {
  ro: {
    title: 'Distribuie',
    facebook: 'Distribuie pe Facebook',
    telegram: 'Distribuie pe Telegram',
    whatsapp: 'Distribuie pe WhatsApp',
    viber: 'Distribuie pe Viber',
    copy: 'Copiază linkul',
    copied: 'Copiat ✓',
    copyFailed: 'Nu s-a putut copia',
  },
  ru: {
    title: 'Поделиться',
    facebook: 'Поделиться в Facebook',
    telegram: 'Поделиться в Telegram',
    whatsapp: 'Поделиться в WhatsApp',
    viber: 'Поделиться в Viber',
    copy: 'Копировать ссылку',
    copied: 'Скопировано ✓',
    copyFailed: 'Не удалось скопировать',
  },
};

export function shareStrings(lang: Lang): ShareStrings {
  return SHARE[lang];
}

// --- Quick buy ("Купить в один клик", feature A2) -------------------------- //

export interface QuickBuyStrings {
  trigger: string; // secondary button label on the PDP
  title: string; // mini-modal heading
  phone: string; // phone field label / placeholder
  name: string; // optional name field label / placeholder
  submit: string; // submit button
  submitting: string; // submit button while pending
  successPre: string; // "Заказ №" — followed by the order number
  successPost: string; // "принят, мы перезвоним"
  close: string; // close / dismiss (aria + confirmation button)
  errPhone: string; // client-side: phone required/too short
  errOutOfStock: string; // 409 out_of_stock
  errNotFound: string; // 404 product_not_found
  errGeneric: string; // validation / anything else
}

const QUICK_BUY: Record<Lang, QuickBuyStrings> = {
  ro: {
    trigger: 'Cumpără într-un clic',
    title: 'Cumpără într-un clic',
    phone: 'Telefon',
    name: 'Nume',
    submit: 'Comandă',
    submitting: 'Se trimite…',
    successPre: 'Comanda №',
    successPost: 'a fost primită, vă vom suna',
    close: 'Închide',
    errPhone: 'Introduceți telefonul',
    errOutOfStock: 'Produsul nu este în stoc',
    errNotFound: 'Produsul nu a fost găsit',
    errGeneric: 'Nu s-a putut plasa comanda',
  },
  ru: {
    trigger: 'Купить в один клик',
    title: 'Купить в один клик',
    phone: 'Телефон',
    name: 'Имя',
    submit: 'Заказать',
    submitting: 'Отправляем…',
    successPre: 'Заказ №',
    successPost: 'принят, мы перезвоним',
    close: 'Закрыть',
    errPhone: 'Введите телефон',
    errOutOfStock: 'Товара нет в наличии',
    errNotFound: 'Товар не найден',
    errGeneric: 'Не удалось оформить заказ',
  },
};

export function quickBuyStrings(lang: Lang): QuickBuyStrings {
  return QUICK_BUY[lang];
}

// --- Search results page chrome -------------------------------------------- //

export interface SearchStrings {
  titlePlain: string;
  titleQueryPre: string; // "Поиск: " prefix for <title>
  resultsForPre: string; // «Результаты по» — followed by the quoted query
  enterQuery: string;
  nothingFoundPre: string; // «Ничего не найдено по» — followed by the query
  prev: string;
  next: string;
}

const SEARCH_STRINGS: Record<Lang, SearchStrings> = {
  ro: {
    titlePlain: 'Căutare',
    titleQueryPre: 'Căutare: ',
    resultsForPre: 'Rezultate pentru',
    enterQuery: 'Introduceți o interogare în bara de căutare.',
    nothingFoundPre: 'Nu s-a găsit nimic pentru',
    prev: '← Înapoi',
    next: 'Înainte →',
  },
  ru: {
    titlePlain: 'Поиск',
    titleQueryPre: 'Поиск: ',
    resultsForPre: 'Результаты по',
    enterQuery: 'Введите запрос в строке поиска.',
    nothingFoundPre: 'Ничего не найдено по',
    prev: '← Назад',
    next: 'Вперёд →',
  },
};

export function searchStrings(lang: Lang): SearchStrings {
  return SEARCH_STRINGS[lang];
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

// --- 404 page (immersive, off-Layout) -------------------------------------- //

export interface NotFoundStrings {
  pageTitle: string; // <title>
  eyebrow: string; // small label above the code — "Eroare 404" / "Ошибка 404"
  headline: string; // hero heading
  description: string; // supporting paragraph
  returnHome: string; // primary CTA
  back: string; // secondary CTA
  networkAlt: string; // aria-label for the decorative network graphic
}

const NOT_FOUND: Record<Lang, NotFoundStrings> = {
  ro: {
    pageTitle: '404 — pagina nu a fost găsită',
    eyebrow: 'Eroare 404',
    headline: 'Ups, această pagină a ieșit de pe hartă.',
    description:
      'Pagina pe care o cauți nu mai există sau a fost mutată. Hai să te aducem înapoi pe drumul cel bun.',
    returnHome: 'Pagina principală',
    back: 'Înapoi',
    networkAlt: 'Rețea abstractă de noduri cu o conexiune întreruptă',
  },
  ru: {
    pageTitle: '404 — страница не найдена',
    eyebrow: 'Ошибка 404',
    headline: 'Упс, эта страница ушла за пределы карты.',
    description:
      'Страница, которую вы ищете, больше не существует или была перемещена. Давайте вернём вас на верный путь.',
    returnHome: 'На главную',
    back: 'Назад',
    networkAlt: 'Абстрактная сеть узлов с одним разорванным соединением',
  },
};

export function notFoundStrings(lang: Lang): NotFoundStrings {
  return NOT_FOUND[lang];
}
