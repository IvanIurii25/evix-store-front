// Typed admin API wrappers over the shared openapi-fetch client.
//
// All calls run from Vue islands in the browser with the httpOnly `access`
// cookie, so every request sends `credentials: 'include'`. Errors come back in
// the unified `{ error: { code, message } }` envelope; `fail()` turns them into
// a thrown Error carrying the human message for the island's catch block.
import { api } from './client';
import type { components } from '../types/api';

type Schemas = components['schemas'];

export type ProductSearchItem = Schemas['ProductSearchItem'];
export type ProductOut = Schemas['ProductOut'];
export type ProductCreate = Schemas['ProductCreate'];
export type ProductUpdate = Schemas['ProductUpdate'];
export type ProductTranslationIn = Schemas['ProductTranslationIn'];
export type MediaAdminOut = Schemas['MediaAdminOut'];
export type CategoryOut = Schemas['CategoryOut'];
export type CategoryCreate = Schemas['CategoryCreate'];
export type CategoryUpdate = Schemas['CategoryUpdate'];
export type CategoryTranslationIn = Schemas['CategoryTranslationIn'];
export type AttributeOut = Schemas['AttributeOut'];
export type AttributeValueOut = Schemas['AttributeValueOut'];
export type VariantAdminOut = Schemas['VariantAdminOut'];
export type VariantCreate = Schemas['VariantCreate'];
export type VariantUpdate = Schemas['VariantUpdate'];
export type OrderOut = Schemas['OrderOut'];
export type CustomerListItem = Schemas['CustomerListItem'];
export type CustomerDetail = Schemas['CustomerDetail'];
export type DashboardSummary = Schemas['DashboardSummary'];
export type RevenueSeries = Schemas['RevenueSeries'];
export type AnalyticsSummary = Schemas['AnalyticsSummary'];
export type TrafficSeries = Schemas['TrafficSeries'];
export type StaffItem = Schemas['StaffItem'];
export type StaffCreate = Schemas['StaffCreate'];
export type StaffUpdate = Schemas['StaffUpdate'];
export type SeoSettings = Schemas['SeoSettings'];
export type BannerAdminOut = Schemas['BannerAdminOut'];
export type BannerCreate = Schemas['BannerCreate'];
export type BannerUpdate = Schemas['BannerUpdate'];
export type BannerTranslationIn = Schemas['BannerTranslationIn'];

const CREDS = { credentials: 'include' as const };

// Shape of the unified error envelope body.
type ErrorBody = { error?: { code?: string; message?: string } };

function fail(error: unknown, fallback: string): never {
  const body = error as ErrorBody | undefined;
  throw new Error(body?.error?.message ?? fallback);
}

// --------------------------------------------------------------------------- //
// Products + catalog
// --------------------------------------------------------------------------- //
export interface ProductFilters {
  search?: string;
  is_active?: boolean;
  low_stock?: boolean;
  on_sale?: boolean;
  /** Only products with no shipping weight entered (carrier pricing queue). */
  no_weight?: boolean;
  limit?: number;
}

export async function listProducts(
  filters: ProductFilters = {},
): Promise<ProductSearchItem[]> {
  const { data, error } = await api.GET('/api/v1/admin/products', {
    params: { query: filters },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить товары');
  return data?.data ?? [];
}

export async function getProduct(id: number): Promise<ProductOut> {
  const { data, error } = await api.GET('/api/v1/admin/products/{product_id}', {
    params: { path: { product_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Товар не найден');
  return data;
}

export async function createProduct(body: ProductCreate): Promise<ProductOut> {
  const { data, error } = await api.POST('/api/v1/admin/products', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать товар');
  return data;
}

export async function updateProduct(
  id: number,
  body: ProductUpdate,
): Promise<ProductOut> {
  const { data, error } = await api.PATCH(
    '/api/v1/admin/products/{product_id}',
    {
      params: { path: { product_id: id } },
      body,
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось сохранить товар');
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/products/{product_id}', {
    params: { path: { product_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить товар');
}

export async function setProductTranslation(
  id: number,
  body: ProductTranslationIn,
): Promise<void> {
  const { error } = await api.PUT(
    '/api/v1/admin/products/{product_id}/translations',
    { params: { path: { product_id: id } }, body, ...CREDS },
  );
  if (error) fail(error, 'Не удалось сохранить перевод');
}

export async function uploadProductMedia(
  id: number,
  file: File,
): Promise<MediaAdminOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST(
    '/api/v1/admin/products/{product_id}/media',
    // openapi-fetch sends FormData as multipart automatically.
    { params: { path: { product_id: id } }, body: form as never, ...CREDS },
  );
  if (error) fail(error, 'Не удалось загрузить изображение');
  return data;
}

export async function deleteProductMedia(
  id: number,
  mediaId: number,
): Promise<void> {
  const { error } = await api.DELETE(
    '/api/v1/admin/products/{product_id}/media/{media_id}',
    { params: { path: { product_id: id, media_id: mediaId } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось удалить изображение');
}

export async function reorderProductMedia(
  id: number,
  orderedIds: number[],
): Promise<MediaAdminOut[]> {
  const { data, error } = await api.PUT(
    '/api/v1/admin/products/{product_id}/media/reorder',
    {
      params: { path: { product_id: id } },
      body: { ordered_ids: orderedIds },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось изменить порядок');
  return data?.data ?? [];
}

// --------------------------------------------------------------------------- //
// Attributes
// --------------------------------------------------------------------------- //
export async function listAttributes(): Promise<AttributeOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/attributes', CREDS);
  if (error) fail(error, 'Не удалось загрузить атрибуты');
  return data ?? [];
}

export async function setProductAttributes(
  id: number,
  value_ids: number[],
): Promise<ProductOut> {
  const { data, error } = await api.PUT(
    '/api/v1/admin/products/{product_id}/attributes',
    {
      params: { path: { product_id: id } },
      body: { value_ids },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось сохранить атрибуты');
  return data;
}

// --------------------------------------------------------------------------- //
// Variants (variable products)
// --------------------------------------------------------------------------- //
export async function listVariants(id: number): Promise<VariantAdminOut[]> {
  const { data, error } = await api.GET(
    '/api/v1/admin/products/{product_id}/variants',
    { params: { path: { product_id: id } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось загрузить вариации');
  return data?.data ?? [];
}

export async function setVariationAttributes(
  id: number,
  attribute_ids: number[],
): Promise<ProductOut> {
  const { data, error } = await api.PUT(
    '/api/v1/admin/products/{product_id}/variation-attributes',
    { params: { path: { product_id: id } }, body: { attribute_ids }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось сохранить атрибуты вариаций');
  return data;
}

export async function createVariant(
  id: number,
  body: VariantCreate,
): Promise<VariantAdminOut> {
  const { data, error } = await api.POST(
    '/api/v1/admin/products/{product_id}/variants',
    { params: { path: { product_id: id } }, body, ...CREDS },
  );
  if (error) fail(error, 'Не удалось создать вариацию');
  return data;
}

export async function generateVariants(id: number): Promise<VariantAdminOut[]> {
  const { data, error } = await api.POST(
    '/api/v1/admin/products/{product_id}/variants/generate',
    { params: { path: { product_id: id } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось сгенерировать вариации');
  return data?.created ?? [];
}

export async function updateVariant(
  variantId: number,
  body: VariantUpdate,
): Promise<VariantAdminOut> {
  const { data, error } = await api.PATCH(
    '/api/v1/admin/variants/{variant_id}',
    {
      params: { path: { variant_id: variantId } },
      body,
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось обновить вариацию');
  return data;
}

export async function deleteVariant(variantId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/variants/{variant_id}', {
    params: { path: { variant_id: variantId } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить вариацию');
}

export async function bindMediaToVariant(
  id: number,
  mediaId: number,
  variantId: number | null,
): Promise<MediaAdminOut> {
  const { data, error } = await api.PUT(
    '/api/v1/admin/products/{product_id}/media/{media_id}/variant',
    {
      params: { path: { product_id: id, media_id: mediaId } },
      body: { variant_id: variantId },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось привязать фото к вариации');
  return data;
}

// --------------------------------------------------------------------------- //
// Categories
// --------------------------------------------------------------------------- //
export async function listCategories(): Promise<CategoryOut[]> {
  // Admin categories list: all categories (active or not), flat + tree-orderable.
  const { data, error } = await api.GET('/api/v1/admin/categories', CREDS);
  if (error) fail(error, 'Не удалось загрузить категории');
  return data ?? [];
}

export async function createCategory(
  body: CategoryCreate,
): Promise<CategoryOut> {
  const { data, error } = await api.POST('/api/v1/admin/categories', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать категорию');
  return data;
}

export async function updateCategory(
  id: number,
  body: CategoryUpdate,
): Promise<CategoryOut> {
  const { data, error } = await api.PATCH(
    '/api/v1/admin/categories/{category_id}',
    { params: { path: { category_id: id } }, body, ...CREDS },
  );
  if (error) fail(error, 'Не удалось сохранить категорию');
  return data;
}

export async function setCategoryTranslation(
  id: number,
  body: CategoryTranslationIn,
): Promise<void> {
  const { error } = await api.PUT(
    '/api/v1/admin/categories/{category_id}/translations',
    { params: { path: { category_id: id } }, body, ...CREDS },
  );
  if (error) fail(error, 'Не удалось сохранить перевод');
}

export async function deleteCategory(id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/categories/{category_id}', {
    params: { path: { category_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить категорию');
}

// --------------------------------------------------------------------------- //
// Orders
// --------------------------------------------------------------------------- //
export interface OrderFilters {
  status?: string;
  q?: string;
  page?: number;
  page_size?: number;
}
export interface OrderPage {
  data: OrderOut[];
  total: number;
  page: number;
  page_size: number;
}

export async function listOrders(
  filters: OrderFilters = {},
): Promise<OrderPage> {
  const { data, error } = await api.GET('/api/v1/admin/orders', {
    params: { query: filters },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить заказы');
  return data as OrderPage;
}

export async function getOrder(number: string): Promise<OrderOut> {
  const { data, error } = await api.GET('/api/v1/admin/orders/{number}', {
    params: { path: { number } },
    ...CREDS,
  });
  if (error) fail(error, 'Заказ не найден');
  return data;
}

export async function transitionOrder(
  number: string,
  body: { to_status?: string | null; to_payment_status?: string | null },
): Promise<OrderOut> {
  const { data, error } = await api.POST(
    '/api/v1/admin/orders/{number}/transition',
    { params: { path: { number } }, body, ...CREDS },
  );
  if (error) fail(error, 'Недопустимый переход статуса');
  return data;
}

// --------------------------------------------------------------------------- //
// Customers
// --------------------------------------------------------------------------- //
export interface CustomerPage {
  data: CustomerListItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function listCustomers(
  filters: { q?: string; page?: number; page_size?: number } = {},
): Promise<CustomerPage> {
  const { data, error } = await api.GET('/api/v1/admin/customers', {
    params: { query: filters },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить клиентов');
  return data as CustomerPage;
}

export async function getCustomer(id: number): Promise<CustomerDetail> {
  const { data, error } = await api.GET('/api/v1/admin/customers/{user_id}', {
    params: { path: { user_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Клиент не найден');
  return data;
}

// --------------------------------------------------------------------------- //
// Dashboard + analytics
// --------------------------------------------------------------------------- //
export interface DateRange {
  date_from?: string;
  date_to?: string;
}

export async function dashboardSummary(
  range: DateRange = {},
): Promise<DashboardSummary> {
  const { data, error } = await api.GET('/api/v1/admin/dashboard/summary', {
    params: { query: range },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить сводку');
  return data;
}

export async function revenueSeries(
  range: DateRange = {},
): Promise<RevenueSeries> {
  const { data, error } = await api.GET(
    '/api/v1/admin/dashboard/revenue-series',
    { params: { query: range }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось загрузить график');
  return data;
}

export async function analyticsSummary(
  range: DateRange = {},
): Promise<AnalyticsSummary> {
  const { data, error } = await api.GET('/api/v1/admin/analytics/summary', {
    params: { query: range },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить аналитику');
  return data;
}

export async function trafficSeries(
  range: DateRange = {},
): Promise<TrafficSeries> {
  const { data, error } = await api.GET(
    '/api/v1/admin/analytics/traffic-series',
    { params: { query: range }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось загрузить график трафика');
  return data;
}

// --------------------------------------------------------------------------- //
// Settings (staff + SEO)
// --------------------------------------------------------------------------- //
export async function listStaff(): Promise<StaffItem[]> {
  const { data, error } = await api.GET('/api/v1/admin/staff', CREDS);
  if (error) fail(error, 'Не удалось загрузить сотрудников');
  return data?.data ?? [];
}

export async function createStaff(body: StaffCreate): Promise<StaffItem> {
  const { data, error } = await api.POST('/api/v1/admin/staff', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать сотрудника');
  return data;
}

export async function updateStaff(
  id: number,
  body: StaffUpdate,
): Promise<StaffItem> {
  const { data, error } = await api.PATCH('/api/v1/admin/staff/{user_id}', {
    params: { path: { user_id: id } },
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось обновить сотрудника');
  return data;
}

export async function getSeo(): Promise<SeoSettings> {
  const { data, error } = await api.GET('/api/v1/admin/settings/seo', CREDS);
  if (error) fail(error, 'Не удалось загрузить SEO');
  return data;
}

export async function putSeo(body: SeoSettings): Promise<SeoSettings> {
  const { data, error } = await api.PUT('/api/v1/admin/settings/seo', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось сохранить SEO');
  return data;
}

// --- Content pages (info/legal) ---------------------------------------------
export type ContentPageAdminOut = Schemas['ContentPageAdminOut'];
export type ContentPageCreate = Schemas['ContentPageCreate'];
export type ContentPageUpdate = Schemas['ContentPageUpdate'];
export type ContentPageTranslationIn = Schemas['ContentPageTranslationIn'];

export async function listContentPages(): Promise<ContentPageAdminOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/content-pages', CREDS);
  if (error) fail(error, 'Не удалось загрузить страницы');
  return data;
}

export async function getContentPageAdmin(
  id: number,
): Promise<ContentPageAdminOut> {
  const { data, error } = await api.GET(
    '/api/v1/admin/content-pages/{page_id}',
    {
      params: { path: { page_id: id } },
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось загрузить страницу');
  return data;
}

export async function createContentPage(
  body: ContentPageCreate,
): Promise<ContentPageAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/content-pages', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать страницу');
  return data;
}

export async function updateContentPage(
  id: number,
  body: ContentPageUpdate,
): Promise<ContentPageAdminOut> {
  const { data, error } = await api.PUT(
    '/api/v1/admin/content-pages/{page_id}',
    {
      params: { path: { page_id: id } },
      body,
      ...CREDS,
    },
  );
  if (error) fail(error, 'Не удалось сохранить страницу');
  return data;
}

export async function deleteContentPage(id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/content-pages/{page_id}', {
    params: { path: { page_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить страницу');
}

// --------------------------------------------------------------------------- //
// Promo codes (coupons)
// --------------------------------------------------------------------------- //
export type PromoOut = Schemas['PromoOut'];
export type PromoCreate = Schemas['PromoCreate'];
export type PromoUpdate = Schemas['PromoUpdate'];

export async function listPromos(): Promise<PromoOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/promo', CREDS);
  if (error) fail(error, 'Не удалось загрузить промокоды');
  return data?.data ?? [];
}

export async function getPromo(id: number): Promise<PromoOut> {
  const { data, error } = await api.GET('/api/v1/admin/promo/{promo_id}', {
    params: { path: { promo_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Промокод не найден');
  return data;
}

export async function createPromo(body: PromoCreate): Promise<PromoOut> {
  const { data, error } = await api.POST('/api/v1/admin/promo', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать промокод');
  return data;
}

export async function updatePromo(
  id: number,
  body: PromoUpdate,
): Promise<PromoOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/promo/{promo_id}', {
    params: { path: { promo_id: id } },
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось сохранить промокод');
  return data;
}

export async function deletePromo(id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/promo/{promo_id}', {
    params: { path: { promo_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить промокод');
}

// --- Restock waiters (demand signal) ----------------------------------------
export async function getRestockWaiters(productId: number): Promise<number> {
  const { data, error } = await api.GET(
    '/api/v1/admin/products/{product_id}/restock-waiters',
    { params: { path: { product_id: productId } }, ...CREDS },
  );
  if (error || !data) return 0;
  return data.count;
}

export type DemandItem = Schemas['DemandItem'];

export async function getRestockDemand(lang = 'ru'): Promise<DemandItem[]> {
  const { data, error } = await api.GET('/api/v1/admin/restock/demand', {
    params: { query: { lang } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить спрос');
  return data;
}

// --- Reviews moderation -----------------------------------------------------
export type AdminReview = Schemas['AdminReviewOut'];
export type AdminReviewList = Schemas['AdminReviewList'];
export type ReviewModerateStatus = 'approved' | 'rejected';

export interface ReviewQueueFilters {
  status?: string | null;
  product_id?: number | null;
  cursor?: string | null;
}

export async function listAdminReviews(
  filters: ReviewQueueFilters = {},
): Promise<AdminReviewList> {
  const { data, error } = await api.GET('/api/v1/admin/reviews', {
    params: {
      query: {
        status: filters.status ?? undefined,
        product_id: filters.product_id ?? undefined,
        cursor: filters.cursor ?? undefined,
      },
    },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить отзывы');
  return data as AdminReviewList;
}

export async function moderateReview(
  id: number,
  status: ReviewModerateStatus,
): Promise<AdminReview> {
  const { data, error } = await api.PATCH('/api/v1/admin/reviews/{review_id}', {
    params: { path: { review_id: id } },
    body: { status },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось изменить статус отзыва');
  return data;
}

export async function deleteAdminReview(id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/reviews/{review_id}', {
    params: { path: { review_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить отзыв');
}

export async function getPendingReviewsCount(): Promise<number> {
  const { data, error } = await api.GET(
    '/api/v1/admin/reviews/pending-count',
    CREDS,
  );
  if (error || !data) return 0;
  return data.count;
}

// --------------------------------------------------------------------------- //
// Nova Post waybills
// --------------------------------------------------------------------------- //
/** Create the carrier waybill for an order; returns the updated order. */
export async function createWaybill(number: string): Promise<OrderOut> {
  const { data, error } = await api.POST(
    '/api/v1/admin/orders/{number}/np/shipment',
    { params: { path: { number } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось создать накладную');
  return data;
}

/** Cancel the carrier waybill for an order; returns the updated order. */
export async function cancelWaybill(number: string): Promise<OrderOut> {
  const { data, error } = await api.DELETE(
    '/api/v1/admin/orders/{number}/np/shipment',
    { params: { path: { number } }, ...CREDS },
  );
  if (error) fail(error, 'Не удалось отменить накладную');
  return data;
}

// --------------------------------------------------------------------------- //
// Homepage banners
// --------------------------------------------------------------------------- //
/** Upload a creative and return its public URL (webp variants are generated). */
export async function uploadAsset(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/admin/assets', {
    body: form as never,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось загрузить изображение');
  return data.url;
}

export async function listBanners(): Promise<BannerAdminOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/banners', CREDS);
  if (error) fail(error, 'Не удалось загрузить баннеры');
  return data ?? [];
}

export async function createBanner(
  body: BannerCreate,
): Promise<BannerAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/banners', {
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось создать баннер');
  return data;
}

export async function updateBanner(
  id: number,
  body: BannerUpdate,
): Promise<BannerAdminOut> {
  const { data, error } = await api.PUT('/api/v1/admin/banners/{banner_id}', {
    params: { path: { banner_id: id } },
    body,
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось сохранить баннер');
  return data;
}

export async function deleteBanner(id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/admin/banners/{banner_id}', {
    params: { path: { banner_id: id } },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось удалить баннер');
}

/** Apply a new display order in one write; returns the reordered list. */
export async function reorderBanners(
  items: { banner_id: number; position: number }[],
): Promise<BannerAdminOut[]> {
  const { data, error } = await api.POST('/api/v1/admin/banners/reorder', {
    body: { items },
    ...CREDS,
  });
  if (error) fail(error, 'Не удалось изменить порядок');
  return data ?? [];
}
