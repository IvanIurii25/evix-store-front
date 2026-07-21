<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import {
  createProduct,
  deleteProduct,
  deleteProductMedia,
  getProduct,
  listCategories,
  reorderProductMedia,
  setProductTranslation,
  updateProduct,
  uploadProductMedia,
  type CategoryOut,
  type ProductOut,
} from '../../api/admin';

const props = defineProps<{ productId?: number }>();

const isEdit = computed(() => typeof props.productId === 'number');

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
  form.is_active = p.is_active;
  media.value = [...p.media].sort((a, b) => a.position - b.position);
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
      } catch {
        notFound.value = true;
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
