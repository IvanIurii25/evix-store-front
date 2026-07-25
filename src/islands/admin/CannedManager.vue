<script setup lang="ts">
import { onMounted, ref } from 'vue';

import {
  listCanned,
  createCanned,
  updateCanned,
  deleteCanned,
  type CannedOut,
  type CannedIn,
} from '../../api/support';

const LANGS = ['ro', 'ru'];

const items = ref<CannedOut[]>([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);

// Edit/create form. `editingId === null` → creating a new template.
const editingId = ref<number | null>(null);
const form = ref<CannedIn>({ title: '', text: '', lang: 'ru', sort_order: 0 });

async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await listCanned();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = null;
  form.value = { title: '', text: '', lang: 'ru', sort_order: 0 };
}

function startEdit(item: CannedOut) {
  editingId.value = item.id;
  form.value = {
    title: item.title,
    text: item.text,
    lang: item.lang,
    sort_order: item.sort_order,
  };
}

async function save() {
  if (!form.value.title.trim() || !form.value.text.trim() || saving.value)
    return;
  saving.value = true;
  error.value = '';
  try {
    if (editingId.value === null) {
      await createCanned(form.value);
    } else {
      await updateCanned(editingId.value, form.value);
    }
    resetForm();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  try {
    await deleteCanned(id);
    if (editingId.value === id) resetForm();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось удалить';
  }
}

onMounted(load);
</script>

<template>
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <!-- Form -->
    <div class="rounded-2xl border-2 border-fill bg-white p-4">
      <h2 class="mb-3 font-medium text-ink">
        {{ editingId === null ? 'Новый шаблон' : 'Редактирование' }}
      </h2>
      <div class="space-y-3">
        <input
          v-model="form.title"
          placeholder="Название (для оператора)"
          class="w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
        <textarea
          v-model="form.text"
          rows="4"
          placeholder="Текст ответа…"
          class="w-full resize-none rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        ></textarea>
        <div class="flex items-center gap-3">
          <select
            v-model="form.lang"
            class="rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
          >
            <option v-for="l in LANGS" :key="l" :value="l">{{ l }}</option>
          </select>
          <input
            v-model.number="form.sort_order"
            type="number"
            class="w-24 rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
            title="Порядок"
          />
        </div>
        <p v-if="error" class="text-sm text-danger">{{ error }}</p>
        <div class="flex gap-2">
          <button
            class="rounded-xl bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
            :disabled="saving || !form.title.trim() || !form.text.trim()"
            @click="save"
          >
            {{ editingId === null ? 'Создать' : 'Сохранить' }}
          </button>
          <button
            v-if="editingId !== null"
            class="rounded-xl bg-fill px-4 py-2 font-medium text-subtle"
            @click="resetForm"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>

    <!-- List -->
    <div>
      <div v-if="loading" class="text-subtle">Загрузка…</div>
      <div
        v-else-if="items.length === 0"
        class="rounded-2xl border-2 border-fill bg-white p-8 text-center text-subtle"
      >
        Шаблонов нет
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="c in items"
          :key="c.id"
          class="rounded-2xl border-2 border-fill bg-white p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium text-ink">
                {{ c.title }}
                <span class="ml-1 text-xs text-subtle">[{{ c.lang }}]</span>
              </p>
              <p class="truncate text-sm text-subtle">{{ c.text }}</p>
            </div>
            <div class="flex shrink-0 gap-1">
              <button
                class="rounded-lg bg-fill px-2 py-1 text-xs text-subtle hover:text-ink"
                @click="startEdit(c)"
              >
                Правка
              </button>
              <button
                class="rounded-lg bg-fill px-2 py-1 text-xs text-subtle hover:text-danger"
                @click="remove(c.id)"
              >
                Удалить
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
