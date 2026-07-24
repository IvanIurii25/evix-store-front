<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { getRestockDemand, type DemandItem } from '../../api/admin';

const items = ref<DemandItem[]>([]);
const loading = ref(true);
const loadError = ref('');

// Filters
const stock = ref<'oos' | 'all' | 'in'>('oos'); // default: what needs restocking
const category = ref<string>('');
const minWaiters = ref(1);
const search = ref('');

type SortKey = 'potential' | 'waiters' | 'waiters_7d';
const sortKey = ref<SortKey>('potential'); // default sort: revenue potential

function potential(it: DemandItem): number {
  return it.waiters * (Number(it.price) || 0);
}
function money(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} L`;
}
function thumb(url: string | null | undefined): string | null {
  return url ? url.replace(/\.[^./]+$/, '_200.webp') : null;
}

const categories = computed(() =>
  [...new Set(items.value.map((i) => i.category).filter(Boolean))].sort(),
);

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  const rows = items.value.filter((i) => {
    if (stock.value === 'oos' && i.in_stock) return false;
    if (stock.value === 'in' && !i.in_stock) return false;
    if (category.value && i.category !== category.value) return false;
    if (i.waiters < minWaiters.value) return false;
    if (term && !i.name.toLowerCase().includes(term)) return false;
    return true;
  });
  return rows.sort((a, b) => {
    if (sortKey.value === 'potential') return potential(b) - potential(a);
    if (sortKey.value === 'waiters_7d') return b.waiters_7d - a.waiters_7d;
    return b.waiters - a.waiters;
  });
});

// KPI strip reflects the current filtered view.
const kpi = computed(() => ({
  products: filtered.value.length,
  waiters: filtered.value.reduce((s, i) => s + i.waiters, 0),
  potential: filtered.value.reduce((s, i) => s + potential(i), 0),
}));

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    items.value = await getRestockDemand('ru');
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const thClickable = 'cursor-pointer select-none hover:text-primary';
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

  <div v-else class="space-y-5">
    <!-- KPI strip -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border-2 border-fill bg-white p-5">
        <p class="text-sm text-subtle">Товаров ждут</p>
        <p class="mt-1 text-2xl font-bold text-ink">{{ kpi.products }}</p>
      </div>
      <div class="rounded-2xl border-2 border-fill bg-white p-5">
        <p class="text-sm text-subtle">Всего ожидающих</p>
        <p class="mt-1 text-2xl font-bold text-primary">{{ kpi.waiters }}</p>
      </div>
      <div class="rounded-2xl border-2 border-fill bg-white p-5">
        <p class="text-sm text-subtle">Потенциал ≈</p>
        <p class="mt-1 text-2xl font-bold text-price">
          {{ money(kpi.potential) }}
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div
      class="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-fill bg-white p-4"
    >
      <div class="flex overflow-hidden rounded-lg border-2 border-fill text-sm">
        <button
          v-for="opt in [
            { k: 'oos', l: 'Нет в наличии' },
            { k: 'all', l: 'Все' },
            { k: 'in', l: 'В наличии' },
          ]"
          :key="opt.k"
          type="button"
          class="px-3 py-1.5 font-medium"
          :class="
            stock === opt.k
              ? 'bg-primary text-white'
              : 'text-body hover:bg-fill'
          "
          @click="stock = opt.k as 'oos' | 'all' | 'in'"
        >
          {{ opt.l }}
        </button>
      </div>
      <select
        v-model="category"
        class="rounded-lg border-2 border-fill px-3 py-1.5 text-sm outline-none focus:border-primary"
      >
        <option value="">Все категории</option>
        <option v-for="c in categories" :key="c!" :value="c">{{ c }}</option>
      </select>
      <select
        v-model.number="minWaiters"
        class="rounded-lg border-2 border-fill px-3 py-1.5 text-sm outline-none focus:border-primary"
      >
        <option :value="1">от 1 ожидающего</option>
        <option :value="3">от 3</option>
        <option :value="5">от 5</option>
        <option :value="10">от 10</option>
      </select>
      <input
        v-model="search"
        type="search"
        placeholder="Поиск товара…"
        class="ml-auto w-56 rounded-lg border-2 border-fill px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
    </div>

    <!-- Table -->
    <div class="overflow-x-auto rounded-2xl border-2 border-fill bg-white">
      <table class="w-full text-sm">
        <thead class="border-b-2 border-fill text-left text-subtle">
          <tr>
            <th class="px-4 py-3 font-medium">Товар</th>
            <th class="px-4 py-3 font-medium">Категория</th>
            <th class="px-4 py-3 font-medium">Наличие</th>
            <th
              class="px-4 py-3 text-right font-medium"
              :class="thClickable"
              @click="sortKey = 'waiters'"
            >
              Ждут{{ sortKey === 'waiters' ? ' ↓' : '' }}
            </th>
            <th
              class="px-4 py-3 text-right font-medium"
              :class="thClickable"
              @click="sortKey = 'waiters_7d'"
            >
              +7д{{ sortKey === 'waiters_7d' ? ' ↓' : '' }}
            </th>
            <th
              class="px-4 py-3 text-right font-medium"
              :class="thClickable"
              @click="sortKey = 'potential'"
            >
              Потенциал{{ sortKey === 'potential' ? ' ↓' : '' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="it in filtered"
            :key="it.product_id"
            class="border-b border-fill transition hover:bg-fill"
          >
            <td class="px-4 py-3">
              <a
                :href="`/admin/products/${it.product_id}`"
                class="flex items-center gap-3 font-medium text-ink hover:text-primary"
              >
                <img
                  v-if="thumb(it.image_url)"
                  :src="thumb(it.image_url)!"
                  alt=""
                  loading="lazy"
                  class="h-10 w-10 shrink-0 rounded-md object-contain"
                />
                <span
                  v-else
                  class="h-10 w-10 shrink-0 rounded-md bg-fill"
                ></span>
                <span class="line-clamp-2">{{ it.name }}</span>
                <span
                  v-if="!it.is_active"
                  class="rounded bg-fill px-1.5 py-0.5 text-xs text-subtle"
                  >неактивен</span
                >
              </a>
            </td>
            <td class="px-4 py-3 text-subtle">{{ it.category || '—' }}</td>
            <td class="px-4 py-3">
              <span
                v-if="!it.in_stock"
                class="rounded-md bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                >Нет в наличии</span
              >
              <span v-else class="text-price">{{ it.qty }} шт</span>
            </td>
            <td class="px-4 py-3 text-right text-lg font-bold text-ink">
              {{ it.waiters }}
            </td>
            <td class="px-4 py-3 text-right">
              <span v-if="it.waiters_7d > 0" class="font-medium text-price"
                >+{{ it.waiters_7d }}</span
              >
              <span v-else class="text-subtle">—</span>
            </td>
            <td class="px-4 py-3 text-right font-medium text-body">
              {{ money(potential(it)) }}
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-subtle">
              Пока никто не ждёт товаров по этому фильтру.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
