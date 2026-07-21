<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { getSeo, putSeo, type SeoSettings } from '../../api/admin';

const loading = ref(true);
const loadError = ref('');

const saving = ref(false);
const saveError = ref('');
const saved = ref(false);

// Editable copy of the settings; filled once loaded.
const form = reactive<SeoSettings>({
  title_ru: '',
  title_ro: '',
  description_ru: '',
  description_ro: '',
  title_suffix: '',
  og_image_url: '',
});

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    Object.assign(form, await getSeo());
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function save() {
  saving.value = true;
  saveError.value = '';
  saved.value = false;
  try {
    Object.assign(form, await putSeo({ ...form }));
    saved.value = true;
    // Auto-dismiss the success toast.
    setTimeout(() => (saved.value = false), 2500);
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Не удалось сохранить';
  } finally {
    saving.value = false;
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

  <form
    v-else
    class="space-y-6 rounded-2xl border-2 border-fill bg-white p-6"
    @submit.prevent="save"
  >
    <div class="grid gap-6 sm:grid-cols-2">
      <div>
        <label class="block text-sm font-medium text-body">
          Заголовок сайта (RU)
        </label>
        <input
          v-model="form.title_ru"
          type="text"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
        <p class="mt-1 text-xs text-subtle">
          Основной заголовок (тег title) для русской версии страниц.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-body">
          Заголовок сайта (RO)
        </label>
        <input
          v-model="form.title_ro"
          type="text"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
        <p class="mt-1 text-xs text-subtle">
          Основной заголовок (тег title) для румынской версии страниц.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-body">
          Описание (RU)
        </label>
        <textarea
          v-model="form.description_ru"
          rows="3"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        ></textarea>
        <p class="mt-1 text-xs text-subtle">
          Мета-описание (meta description) для русской версии — показывается в
          результатах поиска.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-body">
          Описание (RO)
        </label>
        <textarea
          v-model="form.description_ro"
          rows="3"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        ></textarea>
        <p class="mt-1 text-xs text-subtle">
          Мета-описание (meta description) для румынской версии — показывается в
          результатах поиска.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-body">
          Суффикс заголовка
        </label>
        <input
          v-model="form.title_suffix"
          type="text"
          placeholder=" — evix"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
        <p class="mt-1 text-xs text-subtle">
          Приписка в конце каждого заголовка страницы, например « — evix».
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-body">
          Изображение для соцсетей (OG image)
        </label>
        <input
          v-model="form.og_image_url"
          type="url"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
        <p class="mt-1 text-xs text-subtle">
          URL картинки-превью при шеринге ссылок в соцсетях и мессенджерах.
        </p>
      </div>
    </div>

    <p v-if="saveError" class="text-sm text-danger">{{ saveError }}</p>
    <p v-if="saved" class="text-sm text-primary">Настройки сохранены</p>

    <button
      type="submit"
      :disabled="saving"
      class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
    >
      {{ saving ? 'Сохранение…' : 'Сохранить' }}
    </button>
  </form>
</template>
