<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import {
  listCategories,
  createCategory,
  updateCategory,
  setCategoryTranslation,
  deleteCategory,
  type CategoryOut,
} from '../../api/admin';

// --------------------------------------------------------------------------- //
// State
// --------------------------------------------------------------------------- //
const categories = ref<CategoryOut[]>([]);
const loading = ref(true);
const error = ref('');
// Row-level action feedback (toggle / delete), keyed by category id.
const rowError = ref('');

type Lang = 'ru' | 'ro';

// --------------------------------------------------------------------------- //
// Data loading
// --------------------------------------------------------------------------- //
async function reload() {
  loading.value = true;
  error.value = '';
  try {
    categories.value = await listCategories();
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Не удалось загрузить категории';
  } finally {
    loading.value = false;
  }
}

onMounted(reload);

// --------------------------------------------------------------------------- //
// Tree building — order the flat list into a depth-first sequence so an
// indented list renders parents immediately above their children.
// --------------------------------------------------------------------------- //
interface TreeNode {
  category: CategoryOut;
  depth: number;
}

const tree = computed<TreeNode[]>(() => {
  const byParent = new Map<number | null, CategoryOut[]>();
  for (const cat of categories.value) {
    const key = cat.parent_id ?? null;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(cat);
    else byParent.set(key, [cat]);
  }
  for (const bucket of byParent.values()) {
    bucket.sort((a, b) => a.position - b.position || a.id - b.id);
  }

  const out: TreeNode[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const cat of byParent.get(parentId) ?? []) {
      out.push({ category: cat, depth });
      walk(cat.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
});

// Human name (ru) for a category, falling back to any translation or the id.
function ruName(cat: CategoryOut): string {
  const translations = cat.translations ?? [];
  const ru = translations.find((t) => t.lang === 'ru');
  return ru?.name || translations[0]?.name || `#${cat.id}`;
}

// Flat list for the "parent" select in the create form.
const parentOptions = computed(() =>
  tree.value.map(({ category, depth }) => ({
    id: category.id,
    label: `${'— '.repeat(depth)}${ruName(category)}`,
  })),
);

const isEmpty = computed(
  () => !loading.value && !error.value && !categories.value.length,
);

// --------------------------------------------------------------------------- //
// Slug hint
// --------------------------------------------------------------------------- //
const SLUG_HINT = 'Только строчные буквы, цифры и дефисы, минимум 2 символа.';
const SLUG_RE = /^[a-z0-9-]{2,}$/;

// --------------------------------------------------------------------------- //
// Row actions — toggle active, delete
// --------------------------------------------------------------------------- //
const busyRow = ref<number | null>(null);

async function toggleActive(cat: CategoryOut) {
  rowError.value = '';
  busyRow.value = cat.id;
  try {
    await updateCategory(cat.id, { is_active: !cat.is_active });
    await reload();
  } catch (e) {
    rowError.value =
      e instanceof Error ? e.message : 'Не удалось изменить статус';
  } finally {
    busyRow.value = null;
  }
}

async function remove(cat: CategoryOut) {
  if (!confirm(`Удалить категорию «${ruName(cat)}»?`)) return;
  rowError.value = '';
  busyRow.value = cat.id;
  try {
    await deleteCategory(cat.id);
    if (editingId.value === cat.id) editingId.value = null;
    await reload();
  } catch (e) {
    rowError.value =
      e instanceof Error
        ? e.message
        : 'Нельзя удалить: есть подкатегории или товары';
  } finally {
    busyRow.value = null;
  }
}

// --------------------------------------------------------------------------- //
// Create form
// --------------------------------------------------------------------------- //
interface TranslationDraft {
  name: string;
  slug: string;
  seo_title: string;
  seo_description: string;
}

function emptyDraft(): TranslationDraft {
  return { name: '', slug: '', seo_title: '', seo_description: '' };
}

const showCreate = ref(false);
const createTab = ref<Lang>('ru');
const createBusy = ref(false);
const createError = ref('');
const createForm = reactive({
  parent_id: null as number | null,
  is_active: true,
  ru: emptyDraft(),
  ro: emptyDraft(),
});

function openCreate() {
  createError.value = '';
  createTab.value = 'ru';
  createForm.parent_id = null;
  createForm.is_active = true;
  Object.assign(createForm.ru, emptyDraft());
  Object.assign(createForm.ro, emptyDraft());
  showCreate.value = true;
}

function validateDraft(d: TranslationDraft, lang: Lang): string | null {
  const label = lang === 'ru' ? 'русского' : 'румынского';
  if (!d.name.trim()) return `Укажите название для ${label} языка`;
  if (!SLUG_RE.test(d.slug.trim()))
    return `Некорректный slug для ${label} языка. ${SLUG_HINT}`;
  return null;
}

async function submitCreate() {
  createError.value = '';
  const langs: Lang[] = ['ru', 'ro'];
  // Both languages are required to publish a category.
  for (const lang of langs) {
    const problem = validateDraft(createForm[lang], lang);
    if (problem) {
      createError.value = problem;
      createTab.value = lang;
      return;
    }
  }

  createBusy.value = true;
  try {
    await createCategory({
      parent_id: createForm.parent_id,
      position: 0,
      is_active: createForm.is_active,
      translations: langs.map((lang) => ({
        lang,
        name: createForm[lang].name.trim(),
        slug: createForm[lang].slug.trim(),
        seo_title: createForm[lang].seo_title.trim() || null,
        seo_description: createForm[lang].seo_description.trim() || null,
      })),
    });
    showCreate.value = false;
    await reload();
  } catch (e) {
    createError.value =
      e instanceof Error ? e.message : 'Не удалось создать категорию';
  } finally {
    createBusy.value = false;
  }
}

// --------------------------------------------------------------------------- //
// Edit panel — per-language translation editing for an existing category.
// --------------------------------------------------------------------------- //
const editingId = ref<number | null>(null);
const editTab = ref<Lang>('ru');
const editBusy = ref(false);
const editError = ref('');
const editSaved = ref('');
const editForm = reactive({
  ru: emptyDraft(),
  ro: emptyDraft(),
});

function draftFrom(cat: CategoryOut, lang: Lang): TranslationDraft {
  const t = (cat.translations ?? []).find((x) => x.lang === lang);
  return {
    name: t?.name ?? '',
    slug: t?.slug ?? '',
    seo_title: t?.seo_title ?? '',
    seo_description: t?.seo_description ?? '',
  };
}

function toggleEdit(cat: CategoryOut) {
  if (editingId.value === cat.id) {
    editingId.value = null;
    return;
  }
  editError.value = '';
  editSaved.value = '';
  editTab.value = 'ru';
  Object.assign(editForm.ru, draftFrom(cat, 'ru'));
  Object.assign(editForm.ro, draftFrom(cat, 'ro'));
  editingId.value = cat.id;
}

async function saveTranslation(lang: Lang) {
  if (editingId.value == null) return;
  editError.value = '';
  editSaved.value = '';
  const draft = editForm[lang];
  const problem = validateDraft(draft, lang);
  if (problem) {
    editError.value = problem;
    editTab.value = lang;
    return;
  }

  editBusy.value = true;
  try {
    await setCategoryTranslation(editingId.value, {
      lang,
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      seo_title: draft.seo_title.trim() || null,
      seo_description: draft.seo_description.trim() || null,
    });
    editSaved.value =
      lang === 'ru' ? 'Русский перевод сохранён' : 'Румынский перевод сохранён';
    await reload();
  } catch (e) {
    editError.value =
      e instanceof Error ? e.message : 'Не удалось сохранить перевод';
  } finally {
    editBusy.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm text-subtle">
        Дерево категорий каталога. Для публикации нужны оба языка (RU + RO).
      </p>
      <button
        type="button"
        class="shrink-0 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
        @click="openCreate"
      >
        Добавить категорию
      </button>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreate"
      class="rounded-2xl border-2 border-fill bg-white p-6"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-ink">Новая категория</h2>
        <button
          type="button"
          class="text-sm text-subtle hover:text-ink"
          @click="showCreate = false"
        >
          Закрыть
        </button>
      </div>

      <label class="mt-4 block text-sm font-medium text-body">Родитель</label>
      <select
        v-model="createForm.parent_id"
        class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      >
        <option :value="null">— корень —</option>
        <option v-for="opt in parentOptions" :key="opt.id" :value="opt.id">
          {{ opt.label }}
        </option>
      </select>

      <label class="mt-4 flex items-center gap-2 text-sm font-medium text-body">
        <input v-model="createForm.is_active" type="checkbox" />
        Активна
      </label>

      <!-- Language tabs -->
      <div class="mt-5 flex gap-2">
        <button
          v-for="lang in ['ru', 'ro'] as const"
          :key="lang"
          type="button"
          class="rounded-xl border-2 px-4 py-1.5 text-sm font-medium"
          :class="
            createTab === lang
              ? 'border-primary text-primary'
              : 'border-fill text-subtle hover:text-body'
          "
          @click="createTab = lang"
        >
          {{ lang === 'ru' ? 'Русский' : 'Румынский' }}
        </button>
      </div>

      <div v-for="lang in ['ru', 'ro'] as const" :key="`c-${lang}`">
        <div v-show="createTab === lang" class="mt-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-body">Название</label>
            <input
              v-model="createForm[lang].name"
              type="text"
              class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-body">Slug</label>
            <input
              v-model="createForm[lang].slug"
              type="text"
              class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
            />
            <p class="mt-1 text-xs text-subtle">{{ SLUG_HINT }}</p>
          </div>
        </div>
      </div>

      <p v-if="createError" class="mt-3 text-sm text-danger">
        {{ createError }}
      </p>

      <div class="mt-5 flex gap-3">
        <button
          type="button"
          :disabled="createBusy"
          class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          @click="submitCreate"
        >
          {{ createBusy ? 'Сохраняем…' : 'Создать' }}
        </button>
        <button
          type="button"
          class="rounded-xl border-2 border-fill px-4 py-2 font-medium text-body hover:border-primary"
          @click="showCreate = false"
        >
          Отмена
        </button>
      </div>
    </div>

    <!-- States -->
    <p v-if="loading" class="text-subtle">Загрузка…</p>
    <p v-else-if="error" class="text-danger">{{ error }}</p>
    <div
      v-else-if="isEmpty"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-sm text-subtle"
    >
      Категорий пока нет. Нажмите «Добавить категорию», чтобы создать первую.
    </div>

    <!-- Tree -->
    <div v-else class="rounded-2xl border-2 border-fill bg-white p-6">
      <p v-if="rowError" class="mb-4 text-sm text-danger">{{ rowError }}</p>

      <ul class="divide-y divide-fill">
        <li v-for="node in tree" :key="node.category.id" class="py-2">
          <div class="flex items-center gap-3">
            <div
              class="flex min-w-0 flex-1 items-center gap-2"
              :style="{ paddingLeft: `${node.depth * 20}px` }"
            >
              <button
                type="button"
                class="min-w-0 truncate text-left text-body hover:text-primary"
                @click="toggleEdit(node.category)"
              >
                {{ ruName(node.category) }}
              </button>
              <span
                v-if="!node.category.is_active"
                class="shrink-0 rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-subtle"
              >
                неактивна
              </span>
            </div>

            <label
              class="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-subtle"
            >
              <input
                type="checkbox"
                :checked="node.category.is_active"
                :disabled="busyRow === node.category.id"
                @change="toggleActive(node.category)"
              />
              активна
            </label>

            <button
              type="button"
              :disabled="busyRow === node.category.id"
              class="shrink-0 text-sm font-medium text-danger hover:underline disabled:opacity-60"
              @click="remove(node.category)"
            >
              Удалить
            </button>
          </div>

          <!-- Edit panel -->
          <div
            v-if="editingId === node.category.id"
            class="mt-3 rounded-xl border-2 border-fill p-4"
            :style="{ marginLeft: `${node.depth * 20}px` }"
          >
            <div class="flex gap-2">
              <button
                v-for="lang in ['ru', 'ro'] as const"
                :key="`et-${lang}`"
                type="button"
                class="rounded-xl border-2 px-4 py-1.5 text-sm font-medium"
                :class="
                  editTab === lang
                    ? 'border-primary text-primary'
                    : 'border-fill text-subtle hover:text-body'
                "
                @click="editTab = lang"
              >
                {{ lang === 'ru' ? 'Русский' : 'Румынский' }}
              </button>
            </div>

            <div v-for="lang in ['ru', 'ro'] as const" :key="`e-${lang}`">
              <div v-show="editTab === lang" class="mt-4 space-y-3">
                <div>
                  <label class="block text-sm font-medium text-body"
                    >Название</label
                  >
                  <input
                    v-model="editForm[lang].name"
                    type="text"
                    class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-body"
                    >Slug</label
                  >
                  <input
                    v-model="editForm[lang].slug"
                    type="text"
                    class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
                  />
                  <p class="mt-1 text-xs text-subtle">{{ SLUG_HINT }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-body"
                    >SEO Title</label
                  >
                  <input
                    v-model="editForm[lang].seo_title"
                    type="text"
                    class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-body"
                    >SEO Description</label
                  >
                  <textarea
                    v-model="editForm[lang].seo_description"
                    rows="2"
                    class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
                  ></textarea>
                </div>

                <button
                  type="button"
                  :disabled="editBusy"
                  class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                  @click="saveTranslation(lang)"
                >
                  {{
                    editBusy
                      ? 'Сохраняем…'
                      : lang === 'ru'
                        ? 'Сохранить русский'
                        : 'Сохранить румынский'
                  }}
                </button>
              </div>
            </div>

            <p v-if="editError" class="mt-3 text-sm text-danger">
              {{ editError }}
            </p>
            <p v-if="editSaved" class="mt-3 text-sm text-badge-sale">
              {{ editSaved }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
