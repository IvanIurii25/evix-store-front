<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import {
  listProducts,
  type ProductFilters,
  type ProductSearchItem,
} from '../../api/admin';

const items = ref<ProductSearchItem[]>([]);
const loading = ref(true);
const error = ref('');

// Search box (debounced) + toggle filters.
const search = ref('');
// `active` is tri-state: null = all, true = only active, false = only inactive.
const activeFilter = ref<boolean | null>(null);
const lowStock = ref(false);
const onSale = ref(false);

function buildFilters(): ProductFilters {
  const filters: ProductFilters = {};
  const term = search.value.trim();
  if (term) filters.search = term;
  if (activeFilter.value !== null) filters.is_active = activeFilter.value;
  if (lowStock.value) filters.low_stock = true;
  if (onSale.value) filters.on_sale = true;
  return filters;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await listProducts(buildFilters());
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// Re-query when any toggle changes immediately.
watch([activeFilter, lowStock, onSale], load);

// Debounce free-text search so we don't hammer the API per keystroke.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
});

const isEmpty = computed(
  () => !loading.value && !error.value && items.value.length === 0,
);

function toggleActive(value: boolean) {
  activeFilter.value = activeFilter.value === value ? null : value;
}

function money(x: string): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}

function open(id: number) {
  window.location.href = `/admin/products/${id}`;
}

const CHIP_BASE =
  'rounded-xl border-2 px-3 py-1.5 text-sm font-medium transition-colors';
function chip(active: boolean): string {
  return active
    ? `${CHIP_BASE} border-primary bg-primary text-white`
    : `${CHIP_BASE} border-fill bg-white text-body hover:border-primary`;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Поиск по коду или названию…"
        class="min-w-64 flex-1 rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      />
      <a
        href="/admin/products/new"
        class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
      >
        Новый товар
      </a>
    </div>

    <!-- Filter chips -->
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="chip(activeFilter === true)"
        @click="toggleActive(true)"
      >
        Активные
      </button>
      <button
        type="button"
        :class="chip(activeFilter === false)"
        @click="toggleActive(false)"
      >
        Неактивные
      </button>
      <button
        type="button"
        :class="chip(lowStock)"
        @click="lowStock = !lowStock"
      >
        Мало на складе
      </button>
      <button type="button" :class="chip(onSale)" @click="onSale = !onSale">
        Со скидкой
      </button>
    </div>

    <!-- States -->
    <div
      v-if="loading"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
    >
      Загрузка…
    </div>

    <div
      v-else-if="error"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-danger"
    >
      {{ error }}
    </div>

    <div
      v-else-if="isEmpty"
      class="rounded-2xl border-2 border-fill bg-white p-10 text-center"
    >
      <p class="text-subtle">Товаров нет</p>
      <a
        href="/admin/products/new"
        class="mt-4 inline-block rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
      >
        Создать первый товар
      </a>
    </div>

    <!-- Table -->
    <div
      v-else
      class="overflow-hidden rounded-2xl border-2 border-fill bg-white"
    >
      <table class="w-full text-sm">
        <thead class="border-b-2 border-fill text-left text-subtle">
          <tr>
            <th class="px-4 py-3 font-medium">Код</th>
            <th class="px-4 py-3 font-medium">Название</th>
            <th class="px-4 py-3 font-medium">Цена</th>
            <th class="px-4 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in items"
            :key="p.id"
            class="cursor-pointer border-b border-fill last:border-0 hover:bg-fill"
            @click="open(p.id)"
          >
            <td class="px-4 py-3 font-mono text-body">{{ p.code }}</td>
            <td class="px-4 py-3 text-ink">
              {{ p.name || '— без названия —' }}
            </td>
            <td class="px-4 py-3 font-medium text-price">
              {{ money(p.price) }}
            </td>
            <td class="px-4 py-3">
              <span
                v-if="p.is_active"
                class="rounded-lg bg-fill px-2 py-0.5 text-xs font-medium text-body"
              >
                Активен
              </span>
              <span
                v-else
                class="rounded-lg px-2 py-0.5 text-xs font-medium text-subtle"
              >
                Неактивен
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
