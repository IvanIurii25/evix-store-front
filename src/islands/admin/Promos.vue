<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import {
  listPromos,
  createPromo,
  updatePromo,
  deletePromo,
  type PromoOut,
} from '../../api/admin';

interface PromoForm {
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  active_from: string; // datetime-local value (local time, no zone)
  active_to: string;
  min_order_total: string;
  usage_limit: string;
  is_active: boolean;
}

const promos = ref<PromoOut[]>([]);
const loading = ref(true);
const loadError = ref('');

const mode = ref<'list' | 'edit'>('list');
const editingId = ref<number | null>(null);
const saving = ref(false);
const formError = ref('');

const form = reactive<PromoForm>({
  code: '',
  discount_type: 'percent',
  discount_value: '',
  active_from: '',
  active_to: '',
  min_order_total: '',
  usage_limit: '',
  is_active: true,
});

// --- datetime-local <-> ISO helpers -------------------------------------- //
// The API stores UTC ISO datetimes; the <input type="datetime-local"> works in
// the browser's local time. Convert on load/save so the operator sees local
// times while the backend keeps UTC.
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
function localInputToIso(value: string): string {
  // `new Date('YYYY-MM-DDTHH:mm')` is parsed as local time; toISOString() → UTC.
  return new Date(value).toISOString();
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    promos.value = await listPromos();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function resetForm(p?: PromoOut) {
  form.code = p?.code ?? '';
  form.discount_type = (p?.discount_type as 'percent' | 'fixed') ?? 'percent';
  form.discount_value = p?.discount_value ?? '';
  form.active_from = isoToLocalInput(p?.active_from);
  form.active_to = isoToLocalInput(p?.active_to);
  form.min_order_total = p?.min_order_total ?? '';
  form.usage_limit = p?.usage_limit != null ? String(p.usage_limit) : '';
  form.is_active = p?.is_active ?? true;
  formError.value = '';
}

function startNew() {
  editingId.value = null;
  resetForm();
  mode.value = 'edit';
}
function startEdit(p: PromoOut) {
  editingId.value = p.id;
  resetForm(p);
  mode.value = 'edit';
}
function cancel() {
  mode.value = 'list';
}

async function save() {
  formError.value = '';
  if (!form.code.trim()) {
    formError.value = 'Укажите код';
    return;
  }
  if (!form.active_from || !form.active_to) {
    formError.value = 'Укажите окно дат';
    return;
  }
  saving.value = true;
  const body = {
    code: form.code.trim(),
    discount_type: form.discount_type,
    discount_value: form.discount_value,
    active_from: localInputToIso(form.active_from),
    active_to: localInputToIso(form.active_to),
    // <input type="number"> makes Vue cast the model to a number, so these can be
    // number | string | '' at runtime — coerce to string before trimming.
    min_order_total: String(form.min_order_total).trim() || null,
    usage_limit: String(form.usage_limit).trim() ? Number(form.usage_limit) : null,
    is_active: form.is_active,
  };
  try {
    if (editingId.value === null) await createPromo(body);
    else await updatePromo(editingId.value, body);
    await load();
    mode.value = 'list';
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}

async function remove(p: PromoOut) {
  if (!confirm(`Удалить промокод «${p.code}»?`)) return;
  try {
    await deletePromo(p.id);
    await load();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось удалить';
  }
}

function fmtValue(p: PromoOut): string {
  return p.discount_type === 'percent'
    ? `${Number(p.discount_value)}%`
    : `${Number(p.discount_value)} MDL`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
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
        Купоны применяются к подытогу на этапе оформления заказа.
      </p>
      <button
        type="button"
        class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        @click="startNew"
      >
        + Новый промокод
      </button>
    </div>
    <table class="w-full text-sm">
      <thead>
        <tr
          class="border-b-2 border-fill text-left text-xs uppercase text-subtle"
        >
          <th class="py-2">Код</th>
          <th>Скидка</th>
          <th>Мин. заказ</th>
          <th>Лимит</th>
          <th>Действует</th>
          <th class="text-center">Активен</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in promos" :key="p.id" class="border-b border-fill">
          <td class="py-2 font-mono text-xs uppercase">{{ p.code }}</td>
          <td>{{ fmtValue(p) }}</td>
          <td>
            {{ p.min_order_total ? `${Number(p.min_order_total)} MDL` : '—' }}
          </td>
          <td>{{ p.usage_limit ?? '∞' }}</td>
          <td class="text-xs text-subtle">
            {{ fmtDate(p.active_from) }} — {{ fmtDate(p.active_to) }}
          </td>
          <td class="text-center">{{ p.is_active ? '✓' : '—' }}</td>
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
        <tr v-if="promos.length === 0">
          <td colspan="7" class="py-6 text-center text-subtle">
            Промокодов пока нет
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
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="font-medium text-body">Код</span>
        <input
          v-model="form.code"
          type="text"
          placeholder="SALE10"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 font-mono uppercase outline-none focus:border-primary"
        />
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">Тип скидки</span>
        <select
          v-model="form.discount_type"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        >
          <option value="percent">Процент (%)</option>
          <option value="fixed">Фиксированная (MDL)</option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">
          Значение ({{ form.discount_type === 'percent' ? '%' : 'MDL' }})
        </span>
        <input
          v-model="form.discount_value"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">Мин. сумма заказа (опц.)</span>
        <input
          v-model="form.min_order_total"
          type="number"
          step="0.01"
          min="0"
          placeholder="без ограничения"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">Действует с</span>
        <input
          v-model="form.active_from"
          type="datetime-local"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">Действует по</span>
        <input
          v-model="form.active_to"
          type="datetime-local"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label class="block text-sm">
        <span class="font-medium text-body">Лимит использований (опц.)</span>
        <input
          v-model="form.usage_limit"
          type="number"
          min="0"
          placeholder="без лимита"
          class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label class="mt-6 flex items-center gap-2 text-sm">
        <input v-model="form.is_active" type="checkbox" /> Активен
      </label>
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
