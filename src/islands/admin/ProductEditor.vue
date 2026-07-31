<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import {
  bindMediaToVariant,
  createProduct,
  createVariant,
  deleteProduct,
  deleteProductMedia,
  deleteVariant,
  generateVariants,
  getProduct,
  getRestockWaiters,
  listAttributes,
  listCategories,
  reorderProductMedia,
  setProductAttributes,
  setProductTranslation,
  setVariationAttributes,
  updateProduct,
  updateVariant,
  uploadProductMedia,
  type AttributeOut,
  type AttributeValueOut,
  type CategoryOut,
  type ProductOut,
  type VariantAdminOut,
} from '../../api/admin';

const props = defineProps<{ productId?: number }>();

const isEdit = computed(() => typeof props.productId === 'number');

// Number of customers waiting for this product to come back in stock (demand
// signal; a restock save fires their notifications).
const waiters = ref(0);

// ---- lifecycle state -------------------------------------------------------
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const success = ref('');
const notFound = ref(false);

// ---- structural form -------------------------------------------------------
const form = reactive({
  category_id: null as number | null,
  code: '',
  price: '',
  old_price: '' as string,
  qty: 0,
  // Shipping weight in grams. '' means "not entered" (sent as null), which is
  // different from 0 and is what the carrier default keys off. Typed as
  // string | number because Vue casts <input type="number"> bindings.
  weight_g: '' as string | number,
  is_active: false,
});

// ---- translations ----------------------------------------------------------
type Lang = 'ru' | 'ro';
interface TranslationForm {
  name: string;
  slug: string;
  description: string;
  seo_title: string;
  seo_description: string;
}
function blankTranslation(): TranslationForm {
  return {
    name: '',
    slug: '',
    description: '',
    seo_title: '',
    seo_description: '',
  };
}
const translations = reactive<Record<Lang, TranslationForm>>({
  ru: blankTranslation(),
  ro: blankTranslation(),
});
const activeTab = ref<Lang>('ru');

// ---- categories + media ----------------------------------------------------
const categories = ref<CategoryOut[]>([]);
const media = ref<ProductOut['media']>([]);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// ---- attributes (edit mode) ------------------------------------------------
const attributes = ref<AttributeOut[]>([]);
const selectedValueIds = ref<Set<number>>(new Set());

// Ru display name for an attribute, falling back to its code.
function attributeLabel(attr: AttributeOut): string {
  const ru = attr.translations?.find((t) => t.lang === 'ru');
  return ru?.name || attr.code;
}

// Ru display text for an attribute value, falling back to its id.
function valueLabel(value: AttributeValueOut): string {
  const ru = value.translations?.find((t) => t.lang === 'ru');
  return ru?.value || `#${value.id}`;
}

// Locale + number aware ordering so the attribute/value checkbox lists read
// cleanly (e.g. 5 < 10 < 100, letters after) instead of raw insertion order.
const _coll = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const sortedAttributes = computed(() =>
  [...attributes.value].sort((a, b) =>
    _coll.compare(attributeLabel(a), attributeLabel(b)),
  ),
);
function sortedValues(attr: AttributeOut): AttributeValueOut[] {
  return [...(attr.values ?? [])].sort((a, b) =>
    _coll.compare(valueLabel(a), valueLabel(b)),
  );
}

function toggleValue(valueId: number) {
  const next = new Set(selectedValueIds.value);
  if (next.has(valueId)) next.delete(valueId);
  else next.add(valueId);
  selectedValueIds.value = next;
}

// ---- variations (edit mode) ------------------------------------------------
const variationAttributeIds = ref<number[]>([]);
const variants = ref<VariantAdminOut[]>([]);
const variantBusy = ref(false);
const newVariant = reactive<{
  values: Record<number, number | null>;
  code: string;
  price: string;
  old_price: string;
  qty: number;
  weight_g: string | number;
}>({ values: {}, code: '', price: '', old_price: '', qty: 0, weight_g: '' });

// `v-model` on an <input type="number"> is cast to a number by Vue, so these
// fields hold string | number depending on what was typed. Normalize instead of
// assuming either — a bare `.trim()` here has bitten us before (promo form).
function toGrams(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const grams = Number(raw);
  return Number.isFinite(grams) ? grams : Number.NaN;
}

function attributeById(id: number): AttributeOut | undefined {
  return attributes.value.find((a) => a.id === id);
}

// Selector attributes resolved in their stored (display) order.
const variationAttrs = computed(() =>
  variationAttributeIds.value
    .map(attributeById)
    .filter((a): a is AttributeOut => a != null),
);

// Ru label of an attribute value by id (searches every loaded attribute).
function valueLabelById(id: number): string {
  for (const attr of attributes.value) {
    const value = attr.values?.find((v) => v.id === id);
    if (value) return valueLabel(value);
  }
  return `#${id}`;
}

// Human label for a variant row: its chosen option values joined.
function variantLabel(v: VariantAdminOut): string {
  return (v.value_ids ?? []).map(valueLabelById).join(' · ');
}

function toggleVariationAttribute(id: number) {
  const arr = [...variationAttributeIds.value];
  const at = arr.indexOf(id);
  if (at >= 0) arr.splice(at, 1);
  else arr.push(id);
  variationAttributeIds.value = arr;
}

async function applyVariationAttributes() {
  if (!isEdit.value) return;
  variantBusy.value = true;
  error.value = '';
  try {
    await setVariationAttributes(
      props.productId as number,
      variationAttributeIds.value,
    );
    await reloadProduct();
    success.value = 'Атрибуты вариаций сохранены';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    variantBusy.value = false;
  }
}

async function generate() {
  if (!isEdit.value) return;
  variantBusy.value = true;
  error.value = '';
  try {
    await generateVariants(props.productId as number);
    await reloadProduct();
    success.value = 'Вариации сгенерированы';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    variantBusy.value = false;
  }
}

async function addVariant() {
  if (!isEdit.value) return;
  const value_ids = variationAttrs.value
    .map((a) => newVariant.values[a.id])
    .filter((v): v is number => v != null);
  if (value_ids.length !== variationAttrs.value.length) {
    error.value = 'Выберите значение для каждого атрибута вариации';
    return;
  }
  if (!newVariant.price.trim() || Number.isNaN(Number(newVariant.price))) {
    error.value = 'Укажите цену вариации';
    return;
  }
  variantBusy.value = true;
  error.value = '';
  try {
    await createVariant(props.productId as number, {
      value_ids,
      code: newVariant.code.trim() || null,
      price: newVariant.price.trim(),
      old_price: newVariant.old_price.trim()
        ? newVariant.old_price.trim()
        : null,
      qty: Number(newVariant.qty) || 0,
      weight_g: toGrams(newVariant.weight_g),
    });
    newVariant.values = {};
    newVariant.code = '';
    newVariant.price = '';
    newVariant.old_price = '';
    newVariant.qty = 0;
    newVariant.weight_g = '';
    await reloadProduct();
    success.value = 'Вариация добавлена';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    variantBusy.value = false;
  }
}

async function saveVariant(v: VariantAdminOut) {
  variantBusy.value = true;
  error.value = '';
  try {
    await updateVariant(v.id, {
      code: v.code ?? null,
      price: v.price,
      old_price: v.old_price ?? null,
      qty: v.qty,
      weight_g: v.weight_g ?? null,
      is_active: v.is_active,
    });
    await reloadProduct();
    success.value = 'Вариация сохранена';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    variantBusy.value = false;
  }
}

async function removeVariant(id: number) {
  if (!confirm('Удалить вариацию?')) return;
  variantBusy.value = true;
  error.value = '';
  try {
    await deleteVariant(id);
    await reloadProduct();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    variantBusy.value = false;
  }
}

// ---- slug validation -------------------------------------------------------
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function slugValid(slug: string): boolean {
  return slug.length >= 2 && SLUG_RE.test(slug);
}

// Ru category name for the <select> options.
function categoryLabel(cat: CategoryOut): string {
  const ru = cat.translations?.find((t) => t.lang === 'ru');
  return ru?.name || `#${cat.id}`;
}

function money(x: string): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}

// ---- load ------------------------------------------------------------------
function fillFromProduct(p: ProductOut) {
  form.category_id = p.category_id;
  form.code = p.code;
  form.price = p.price;
  form.old_price = p.old_price ?? '';
  form.qty = p.qty;
  form.weight_g = p.weight_g ?? '';
  form.is_active = p.is_active;
  media.value = [...p.media].sort((a, b) => a.position - b.position);
  selectedValueIds.value = new Set(p.value_ids ?? []);
  variationAttributeIds.value = [...(p.variation_attribute_ids ?? [])];
  variants.value = [...(p.variants ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  for (const lang of ['ru', 'ro'] as Lang[]) {
    const t = p.translations.find((tr) => tr.lang === lang);
    translations[lang] = t
      ? {
          name: t.name,
          slug: t.slug,
          description: t.description ?? '',
          seo_title: t.seo_title ?? '',
          seo_description: t.seo_description ?? '',
        }
      : blankTranslation();
  }
}

async function reloadProduct() {
  if (!isEdit.value) return;
  const p = await getProduct(props.productId as number);
  fillFromProduct(p);
}

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    categories.value = await listCategories();
    if (isEdit.value) {
      try {
        await reloadProduct();
        waiters.value = await getRestockWaiters(props.productId as number);
      } catch {
        notFound.value = true;
      }
      // Attribute listing is non-fatal: the editor must load even without it.
      try {
        attributes.value = await listAttributes();
      } catch {
        attributes.value = [];
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
});

// ---- validation ------------------------------------------------------------
function validate(): string | null {
  if (form.category_id == null) return 'Выберите категорию';
  if (!form.code.trim()) return 'Укажите код товара';
  if (!form.price.trim() || Number.isNaN(Number(form.price)))
    return 'Укажите корректную цену';
  if (form.old_price && Number.isNaN(Number(form.old_price)))
    return 'Старая цена указана неверно';
  const grams = toGrams(form.weight_g);
  if (grams !== null && (Number.isNaN(grams) || grams < 0))
    return 'Вес указан неверно (граммы, целое число)';
  return null;
}

// ---- save ------------------------------------------------------------------
function structuralPayload() {
  return {
    category_id: form.category_id as number,
    code: form.code.trim(),
    price: form.price.trim(),
    old_price: form.old_price.trim() ? form.old_price.trim() : null,
    qty: Number(form.qty) || 0,
    weight_g: toGrams(form.weight_g),
    is_active: form.is_active,
  };
}

function translationPayload(lang: Lang) {
  const t = translations[lang];
  return {
    lang,
    name: t.name.trim(),
    slug: t.slug.trim(),
    description: t.description.trim() || null,
    seo_title: t.seo_title.trim() || null,
    seo_description: t.seo_description.trim() || null,
  };
}

async function save() {
  error.value = '';
  success.value = '';
  const problem = validate();
  if (problem) {
    error.value = problem;
    return;
  }
  saving.value = true;
  try {
    if (isEdit.value) {
      const id = props.productId as number;
      await updateProduct(id, structuralPayload());
      // Persist only the languages that have a name filled in.
      for (const lang of ['ru', 'ro'] as Lang[]) {
        if (translations[lang].name.trim()) {
          await setProductTranslation(id, translationPayload(lang));
        }
      }
      await setProductAttributes(id, [...selectedValueIds.value]);
      await reloadProduct();
      success.value = 'Товар сохранён';
    } else {
      const trs = (['ru', 'ro'] as Lang[])
        .filter((lang) => translations[lang].name.trim())
        .map(translationPayload);
      const created = await createProduct({
        ...structuralPayload(),
        translations: trs,
      });
      window.location.href = `/admin/products/${created.id}`;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка сохранения';
  } finally {
    saving.value = false;
  }
}

// ---- media actions (edit mode) --------------------------------------------
async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !isEdit.value) return;
  uploading.value = true;
  error.value = '';
  try {
    await uploadProductMedia(props.productId as number, file);
    await reloadProduct();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки файла';
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

// Bind an image to a variant (variable products), or unbind to the shared
// gallery when variantId is null.
async function bindMedia(mediaId: number, variantId: number | null) {
  if (!isEdit.value) return;
  try {
    await bindMediaToVariant(props.productId as number, mediaId, variantId);
    await reloadProduct();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось привязать фото';
  }
}

async function removeMedia(mediaId: number) {
  if (!isEdit.value) return;
  try {
    await deleteProductMedia(props.productId as number, mediaId);
    await reloadProduct();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось удалить';
  }
}

async function moveMedia(index: number, dir: -1 | 1) {
  const next = index + dir;
  if (next < 0 || next >= media.value.length) return;
  const ids = media.value.map((m) => m.id);
  [ids[index], ids[next]] = [ids[next], ids[index]];
  try {
    const updated = await reorderProductMedia(props.productId as number, ids);
    media.value = [...updated].sort((a, b) => a.position - b.position);
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Не удалось изменить порядок';
  }
}

// ---- delete product --------------------------------------------------------
async function removeProduct() {
  if (!isEdit.value) return;
  if (!confirm('Удалить товар безвозвратно?')) return;
  saving.value = true;
  try {
    await deleteProduct(props.productId as number);
    window.location.href = '/admin/products';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось удалить товар';
    saving.value = false;
  }
}

const inputCls =
  'w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary';
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div
      v-if="loading"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
    >
      Загрузка…
    </div>

    <div
      v-else-if="notFound"
      class="rounded-2xl border-2 border-fill bg-white p-6"
    >
      <p class="text-danger">Товар не найден</p>
      <a
        href="/admin/products"
        class="mt-3 inline-block text-primary hover:underline"
      >
        ← К списку товаров
      </a>
    </div>

    <template v-else>
      <!-- Toasts -->
      <p
        v-if="success"
        class="rounded-xl border-2 border-primary bg-white px-4 py-2 text-sm text-primary"
      >
        {{ success }}
      </p>
      <p
        v-if="error"
        class="rounded-xl border-2 border-danger bg-white px-4 py-2 text-sm text-danger"
      >
        {{ error }}
      </p>

      <!-- Structural fields -->
      <section class="rounded-2xl border-2 border-fill bg-white p-6">
        <h2 class="text-base font-semibold text-ink">Основные данные</h2>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-body">Категория</label>
            <select
              v-model.number="form.category_id"
              :class="['mt-1', inputCls]"
            >
              <option :value="null" disabled>— выберите категорию —</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ categoryLabel(c) }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-body">Код</label>
            <input
              v-model="form.code"
              type="text"
              :class="['mt-1', inputCls]"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-body"
              >Наличие (qty)</label
            >
            <input
              v-model.number="form.qty"
              type="number"
              min="0"
              :class="['mt-1', inputCls]"
            />
            <p v-if="waiters > 0" class="mt-1 text-xs font-medium text-primary">
              ⏳ {{ waiters }} ожидают поступления — сохранение с
              qty&nbsp;&gt;&nbsp;0 разошлёт уведомления
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-body">Цена</label>
            <input
              v-model="form.price"
              type="text"
              :class="['mt-1', inputCls]"
            />
            <p v-if="form.price" class="mt-1 text-xs text-price">
              {{ money(form.price) }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-body">Вес, г</label>
            <input
              v-model="form.weight_g"
              type="number"
              min="0"
              step="1"
              placeholder="не задан"
              :class="['mt-1', inputCls]"
            />
            <p class="mt-1 text-xs text-subtle">
              Вес посылки для расчёта доставки. Пусто — используется значение по
              умолчанию.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-body">
              Старая цена
              <span class="text-subtle">(опц.)</span>
            </label>
            <input
              v-model="form.old_price"
              type="text"
              :class="['mt-1', inputCls]"
            />
          </div>

          <div class="sm:col-span-2">
            <label
              class="flex items-center gap-2 text-sm font-medium text-body"
            >
              <input
                v-model="form.is_active"
                type="checkbox"
                class="h-4 w-4 rounded border-2 border-fill accent-primary"
              />
              Товар активен (виден в каталоге)
            </label>
          </div>
        </div>
      </section>

      <!-- Translations -->
      <section class="rounded-2xl border-2 border-fill bg-white p-6">
        <h2 class="text-base font-semibold text-ink">Переводы</h2>
        <p class="mt-1 text-sm text-subtle">
          Для публикации нужны оба языка (ru и ро).
        </p>

        <div class="mt-4 flex gap-2">
          <button
            v-for="lang in ['ru', 'ro'] as ('ru' | 'ro')[]"
            :key="lang"
            type="button"
            :class="[
              'rounded-xl border-2 px-4 py-1.5 text-sm font-medium uppercase transition-colors',
              activeTab === lang
                ? 'border-primary bg-primary text-white'
                : 'border-fill bg-white text-body hover:border-primary',
            ]"
            @click="activeTab = lang"
          >
            {{ lang }}
          </button>
        </div>

        <div class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-body">Название</label>
            <input
              v-model="translations[activeTab].name"
              type="text"
              :class="['mt-1', inputCls]"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-body"
              >Slug (URL)</label
            >
            <input
              v-model="translations[activeTab].slug"
              type="text"
              :class="[
                'mt-1',
                inputCls,
                translations[activeTab].slug &&
                !slugValid(translations[activeTab].slug)
                  ? 'border-danger focus:border-danger'
                  : '',
              ]"
            />
            <p
              class="mt-1 text-xs"
              :class="
                translations[activeTab].slug &&
                !slugValid(translations[activeTab].slug)
                  ? 'text-danger'
                  : 'text-subtle'
              "
            >
              Строчные буквы, цифры и дефисы (например: my-product), мин. 2
              символа.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-body">Описание</label>
            <textarea
              v-model="translations[activeTab].description"
              rows="4"
              :class="['mt-1', inputCls]"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-body">SEO title</label>
            <input
              v-model="translations[activeTab].seo_title"
              type="text"
              :class="['mt-1', inputCls]"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-body">
              SEO description
            </label>
            <textarea
              v-model="translations[activeTab].seo_description"
              rows="2"
              :class="['mt-1', inputCls]"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Media (edit only) -->
      <section
        v-if="isEdit"
        class="rounded-2xl border-2 border-fill bg-white p-6"
      >
        <h2 class="text-base font-semibold text-ink">Изображения</h2>

        <div
          v-if="media.length"
          class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3"
        >
          <div
            v-for="(m, i) in media"
            :key="m.id"
            class="group relative overflow-hidden rounded-xl border-2 border-fill"
          >
            <img
              :src="m.url"
              :alt="`media ${m.id}`"
              class="aspect-square w-full object-cover"
            />
            <button
              type="button"
              title="Удалить"
              class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg bg-danger text-white opacity-90 hover:opacity-100"
              @click="removeMedia(m.id)"
            >
              ×
            </button>
            <div class="absolute bottom-1 left-1 flex gap-1">
              <button
                type="button"
                title="Влево"
                :disabled="i === 0"
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-body shadow disabled:opacity-40"
                @click="moveMedia(i, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                title="Вправо"
                :disabled="i === media.length - 1"
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-body shadow disabled:opacity-40"
                @click="moveMedia(i, 1)"
              >
                ↓
              </button>
            </div>
            <select
              v-if="variants.length"
              class="block w-full border-t-2 border-fill bg-white px-2 py-1 text-xs text-body outline-none focus:border-primary"
              title="Привязать фото к вариации"
              :value="m.variant_id ?? ''"
              @change="
                bindMedia(
                  m.id,
                  ($event.target as HTMLSelectElement).value
                    ? Number(($event.target as HTMLSelectElement).value)
                    : null,
                )
              "
            >
              <option value="">Общая галерея</option>
              <option v-for="v in variants" :key="v.id" :value="v.id">
                {{ variantLabel(v) }}
              </option>
            </select>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-subtle">Изображений пока нет.</p>

        <label class="mt-4 block text-sm font-medium text-body">
          Загрузить изображение
        </label>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          :disabled="uploading"
          class="mt-1 block w-full text-sm text-body file:mr-3 file:rounded-xl file:border-2 file:border-fill file:bg-white file:px-4 file:py-2 file:font-medium file:text-body hover:file:border-primary"
          @change="onUpload"
        />
        <p v-if="uploading" class="mt-2 text-sm text-subtle">Загрузка…</p>
      </section>

      <!-- Attributes (edit only) -->
      <section
        v-if="isEdit"
        class="rounded-2xl border-2 border-fill bg-white p-6"
      >
        <h2 class="text-base font-semibold text-ink">Атрибуты</h2>

        <div v-if="attributes.length" class="mt-4 space-y-4">
          <div v-for="attr in sortedAttributes" :key="attr.id">
            <p class="text-sm font-medium text-body">
              {{ attributeLabel(attr) }}
            </p>
            <div class="mt-2 flex flex-wrap gap-4">
              <label
                v-for="value in sortedValues(attr)"
                :key="value.id"
                class="flex items-center gap-2 text-sm text-body"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-2 border-fill accent-primary"
                  :checked="selectedValueIds.has(value.id)"
                  @change="toggleValue(value.id)"
                />
                {{ valueLabel(value) }}
              </label>
            </div>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-subtle">Атрибутов пока нет.</p>
      </section>

      <!-- Variations (edit only) -->
      <section
        v-if="isEdit"
        class="rounded-2xl border-2 border-fill bg-white p-6"
      >
        <h2 class="text-base font-semibold text-ink">Вариации</h2>
        <p class="mt-1 text-xs text-subtle">
          Для вариативного товара цена/наличие берутся из вариаций. Отметьте
          атрибуты-селекторы, затем сгенерируйте или добавьте комбинации. Фото
          вариаций назначаются в разделе «Изображения» (выпадающий список под
          картинкой). Порядок для активного товара: сначала снимите «активен»,
          задайте атрибуты и вариации, затем снова включите «активен».
        </p>

        <!-- Which attributes are variation selectors -->
        <div class="mt-4">
          <p class="text-sm font-medium text-body">Атрибуты вариаций</p>
          <div v-if="attributes.length" class="mt-2 flex flex-wrap gap-4">
            <label
              v-for="attr in sortedAttributes"
              :key="attr.id"
              class="flex items-center gap-2 text-sm text-body"
            >
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-2 border-fill accent-primary"
                :checked="variationAttributeIds.includes(attr.id)"
                @change="toggleVariationAttribute(attr.id)"
              />
              {{ attributeLabel(attr) }}
            </label>
          </div>
          <p v-else class="mt-2 text-sm text-subtle">
            Сначала создайте атрибуты.
          </p>
          <button
            type="button"
            :disabled="variantBusy"
            class="mt-3 rounded-xl border-2 border-fill px-3 py-1.5 text-sm font-medium hover:border-primary disabled:opacity-60"
            @click="applyVariationAttributes"
          >
            Применить атрибуты вариаций
          </button>
        </div>

        <template v-if="variationAttrs.length">
          <!-- Existing combinations (inline edit) -->
          <div class="mt-6">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-body">
                Комбинации ({{ variants.length }})
              </p>
              <button
                type="button"
                :disabled="variantBusy"
                class="rounded-xl border-2 border-fill px-3 py-1.5 text-sm hover:border-primary disabled:opacity-60"
                @click="generate"
              >
                Сгенерировать все
              </button>
            </div>

            <div v-if="variants.length" class="mt-3 space-y-2">
              <div
                v-for="v in variants"
                :key="v.id"
                class="grid grid-cols-12 items-center gap-2 rounded-xl border-2 border-fill px-3 py-2 text-sm"
              >
                <div class="col-span-3 font-medium text-ink">
                  {{ variantLabel(v) }}
                </div>
                <input
                  v-model="v.code"
                  placeholder="SKU"
                  class="col-span-2 rounded-lg border-2 border-fill px-2 py-1"
                />
                <input
                  v-model="v.price"
                  placeholder="Цена"
                  class="col-span-2 rounded-lg border-2 border-fill px-2 py-1"
                />
                <input
                  v-model="v.old_price"
                  placeholder="Старая"
                  class="col-span-1 rounded-lg border-2 border-fill px-2 py-1"
                />
                <input
                  v-model.number="v.qty"
                  type="number"
                  placeholder="Кол-во"
                  class="col-span-1 rounded-lg border-2 border-fill px-2 py-1"
                />
                <input
                  v-model.number="v.weight_g"
                  type="number"
                  min="0"
                  placeholder="Вес, г"
                  title="Вес вариации в граммах; пусто — берётся вес товара"
                  class="col-span-1 rounded-lg border-2 border-fill px-2 py-1"
                />
                <label class="col-span-1 flex items-center gap-1 text-xs">
                  <input
                    v-model="v.is_active"
                    type="checkbox"
                    class="h-4 w-4 accent-primary"
                  />вкл
                </label>
                <div class="col-span-1 flex justify-end gap-1">
                  <button
                    type="button"
                    :disabled="variantBusy"
                    class="rounded-lg bg-primary px-2 py-1 text-white disabled:opacity-60"
                    @click="saveVariant(v)"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    :disabled="variantBusy"
                    class="rounded-lg border-2 border-fill px-2 py-1 text-danger disabled:opacity-60"
                    @click="removeVariant(v.id)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-subtle">Вариаций пока нет.</p>
          </div>

          <!-- Manual add -->
          <div class="mt-5 rounded-xl border-2 border-dashed border-fill p-3">
            <p class="text-sm font-medium text-body">Добавить вариацию</p>
            <div class="mt-2 flex flex-wrap items-end gap-2">
              <div v-for="attr in variationAttrs" :key="attr.id">
                <label class="block text-xs text-subtle">{{
                  attributeLabel(attr)
                }}</label>
                <select
                  v-model.number="newVariant.values[attr.id]"
                  class="rounded-lg border-2 border-fill px-2 py-1 text-sm"
                >
                  <option :value="undefined" disabled>—</option>
                  <option
                    v-for="val in sortedValues(attr)"
                    :key="val.id"
                    :value="val.id"
                  >
                    {{ valueLabel(val) }}
                  </option>
                </select>
              </div>
              <input
                v-model="newVariant.code"
                placeholder="SKU"
                class="w-24 rounded-lg border-2 border-fill px-2 py-1 text-sm"
              />
              <input
                v-model="newVariant.price"
                placeholder="Цена"
                class="w-24 rounded-lg border-2 border-fill px-2 py-1 text-sm"
              />
              <input
                v-model="newVariant.old_price"
                placeholder="Старая"
                class="w-24 rounded-lg border-2 border-fill px-2 py-1 text-sm"
              />
              <input
                v-model.number="newVariant.qty"
                type="number"
                placeholder="Кол-во"
                class="w-20 rounded-lg border-2 border-fill px-2 py-1 text-sm"
              />
              <input
                v-model="newVariant.weight_g"
                type="number"
                min="0"
                placeholder="Вес, г"
                class="w-20 rounded-lg border-2 border-fill px-2 py-1 text-sm"
              />
              <button
                type="button"
                :disabled="variantBusy"
                class="rounded-lg bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-60"
                @click="addVariant"
              >
                Добавить
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          :disabled="saving"
          class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          @click="save"
        >
          {{ saving ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Создать товар' }}
        </button>

        <button
          v-if="isEdit"
          type="button"
          :disabled="saving"
          class="rounded-xl border-2 border-fill px-4 py-2 font-medium text-danger hover:border-danger disabled:opacity-60"
          @click="removeProduct"
        >
          Удалить товар
        </button>
      </div>

      <a
        href="/admin/products"
        class="inline-block text-sm text-subtle hover:text-primary"
      >
        ← К списку товаров
      </a>
    </template>
  </div>
</template>
