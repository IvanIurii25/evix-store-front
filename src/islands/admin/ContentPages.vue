<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import {
  listContentPages,
  createContentPage,
  updateContentPage,
  deleteContentPage,
  type ContentPageAdminOut,
} from '../../api/admin';
import { renderMarkdown } from '../../lib/markdown';

interface LangForm {
  title: string;
  body: string;
  seo_description: string;
}
interface PageForm {
  slug: string;
  is_published: boolean;
  show_in_footer: boolean;
  position: number;
  ru: LangForm;
  ro: LangForm;
}

const pages = ref<ContentPageAdminOut[]>([]);
const loading = ref(true);
const loadError = ref('');

const mode = ref<'list' | 'edit'>('list');
const editingId = ref<number | null>(null);
const saving = ref(false);
const formError = ref('');
const activeLang = ref<'ru' | 'ro'>('ru');
const showPreview = ref(false);

function emptyLang(): LangForm {
  return { title: '', body: '', seo_description: '' };
}
const form = reactive<PageForm>({
  slug: '',
  is_published: true,
  show_in_footer: true,
  position: 0,
  ru: emptyLang(),
  ro: emptyLang(),
});

const previewHtml = computed(() => renderMarkdown(form[activeLang.value].body));

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    pages.value = await listContentPages();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function resetForm(p?: ContentPageAdminOut) {
  form.slug = p?.slug ?? '';
  form.is_published = p?.is_published ?? true;
  form.show_in_footer = p?.show_in_footer ?? true;
  form.position = p?.position ?? 0;
  for (const lang of ['ru', 'ro'] as const) {
    const t = p?.translations.find((x) => x.lang === lang);
    form[lang] = {
      title: t?.title ?? '',
      body: t?.body ?? '',
      seo_description: t?.seo_description ?? '',
    };
  }
  formError.value = '';
  activeLang.value = 'ru';
  showPreview.value = false;
}

function startNew() {
  editingId.value = null;
  resetForm();
  mode.value = 'edit';
}
function startEdit(p: ContentPageAdminOut) {
  editingId.value = p.id;
  resetForm(p);
  mode.value = 'edit';
}
function cancel() {
  mode.value = 'list';
}

async function save() {
  saving.value = true;
  formError.value = '';
  const body = {
    slug: form.slug,
    is_published: form.is_published,
    show_in_footer: form.show_in_footer,
    position: form.position,
    translations: (['ru', 'ro'] as const).map((lang) => ({
      lang,
      title: form[lang].title,
      body: form[lang].body,
      seo_description: form[lang].seo_description || null,
    })),
  };
  try {
    if (editingId.value === null) await createContentPage(body);
    else await updateContentPage(editingId.value, body);
    await load();
    mode.value = 'list';
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}

async function remove(p: ContentPageAdminOut) {
  if (!confirm(`Удалить страницу «${p.slug}»?`)) return;
  try {
    await deleteContentPage(p.id);
    await load();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось удалить';
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
  >
    Загрузка…
  </div>
  <div
    v-else-if="loadError"
    class="rounded-2xl border-2 border-fill bg-white p-6 text-danger"
  >
    {{ loadError }}
  </div>

  <!-- List -->
  <div
    v-else-if="mode === 'list'"
    class="rounded-2xl border-2 border-fill bg-white p-6"
  >
    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-subtle">
        Инфо/юридические страницы магазина. Тело — Markdown.
      </p>
      <button
        type="button"
        class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        @click="startNew"
      >
        + Новая страница
      </button>
    </div>
    <table class="w-full text-sm">
      <thead>
        <tr
          class="border-b-2 border-fill text-left text-xs uppercase text-subtle"
        >
          <th class="py-2">Slug</th>
          <th>Заголовок (RU)</th>
          <th class="text-center">Опубл.</th>
          <th class="text-center">В футере</th>
          <th class="text-center">Поз.</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in pages" :key="p.id" class="border-b border-fill">
          <td class="py-2 font-mono text-xs">{{ p.slug }}</td>
          <td>{{ p.translations.find((t) => t.lang === 'ru')?.title }}</td>
          <td class="text-center">{{ p.is_published ? '✓' : '—' }}</td>
          <td class="text-center">{{ p.show_in_footer ? '✓' : '—' }}</td>
          <td class="text-center">{{ p.position }}</td>
          <td class="text-right">
            <button
              type="button"
              class="rounded-lg border-2 border-fill px-3 py-1 font-medium text-body hover:bg-fill"
              @click="startEdit(p)"
            >
              Изменить
            </button>
            <button
              type="button"
              class="ml-2 rounded-lg border-2 border-fill px-3 py-1 font-medium text-danger hover:bg-fill"
              @click="remove(p)"
            >
              Удалить
            </button>
          </td>
        </tr>
        <tr v-if="pages.length === 0">
          <td colspan="6" class="py-6 text-center text-subtle">
            Страниц пока нет
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Editor -->
  <form
    v-else
    class="space-y-6 rounded-2xl border-2 border-fill bg-white p-6"
    @submit.prevent="save"
  >
    <div class="grid gap-4 sm:grid-cols-4">
      <label class="block text-sm">
        <span class="font-medium text-body">Slug</span>
        <input
          v-model="form.slug"
          type="text"
          placeholder="delivery"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 font-mono outline-none focus:border-primary"
        />
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">Позиция</span>
        <input
          v-model.number="form.position"
          type="number"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label class="mt-6 flex items-center gap-2 text-sm">
        <input v-model="form.is_published" type="checkbox" /> Опубликована
      </label>
      <label class="mt-6 flex items-center gap-2 text-sm">
        <input v-model="form.show_in_footer" type="checkbox" /> В футере
      </label>
    </div>

    <div class="flex gap-2 text-sm">
      <button
        type="button"
        :class="
          activeLang === 'ru'
            ? 'bg-primary text-white'
            : 'border-2 border-fill text-body'
        "
        class="rounded-lg px-3 py-1.5 font-medium"
        @click="activeLang = 'ru'"
      >
        RU
      </button>
      <button
        type="button"
        :class="
          activeLang === 'ro'
            ? 'bg-primary text-white'
            : 'border-2 border-fill text-body'
        "
        class="rounded-lg px-3 py-1.5 font-medium"
        @click="activeLang = 'ro'"
      >
        RO
      </button>
      <button
        type="button"
        class="ml-auto rounded-lg border-2 border-fill px-3 py-1.5 font-medium text-body hover:bg-fill"
        @click="showPreview = !showPreview"
      >
        {{ showPreview ? 'Редактор' : 'Превью' }}
      </button>
    </div>

    <div>
      <label class="block text-sm font-medium text-body"
        >Заголовок ({{ activeLang.toUpperCase() }})</label
      >
      <input
        v-model="form[activeLang].title"
        type="text"
        class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-body">Тело (Markdown)</label>
      <textarea
        v-if="!showPreview"
        v-model="form[activeLang].body"
        rows="14"
        class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 font-mono text-sm outline-none focus:border-primary"
      ></textarea>
      <div
        v-else
        class="prose-content mt-1 min-h-[14rem] rounded-xl border-2 border-fill p-4"
        v-html="previewHtml"
      ></div>
    </div>

    <div>
      <label class="block text-sm font-medium text-body"
        >SEO-описание ({{ activeLang.toUpperCase() }})</label
      >
      <textarea
        v-model="form[activeLang].seo_description"
        rows="2"
        class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      ></textarea>
    </div>

    <p v-if="formError" class="text-sm text-danger">{{ formError }}</p>

    <div class="flex gap-2">
      <button
        type="submit"
        :disabled="saving"
        class="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
      <button
        type="button"
        class="rounded-xl border-2 border-fill px-5 py-2 text-sm font-medium text-body hover:bg-fill"
        @click="cancel"
      >
        Отмена
      </button>
    </div>
  </form>
</template>

<style scoped>
.prose-content :deep(h2) {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 1rem 0 0.4rem;
}
.prose-content :deep(p) {
  line-height: 1.6;
  margin-bottom: 0.6rem;
}
.prose-content :deep(ul) {
  list-style: disc;
  padding-left: 1.4rem;
  margin-bottom: 0.6rem;
}
</style>
