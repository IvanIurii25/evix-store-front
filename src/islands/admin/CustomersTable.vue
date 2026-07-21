<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { listCustomers, type CustomerListItem } from '../../api/admin';

const PAGE_SIZE = 20;

const items = ref<CustomerListItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const error = ref('');

// Free-text search over email/phone.
const search = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / PAGE_SIZE)),
);

const isEmpty = computed(
  () => !loading.value && !error.value && items.value.length === 0,
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const term = search.value.trim();
    const res = await listCustomers({
      q: term || undefined,
      page: page.value,
      page_size: PAGE_SIZE,
    });
    items.value = res.data;
    total.value = res.total;
    page.value = res.page;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// Debounce the search box; reset to the first page on a new term.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    load();
  }, 300);
});

function prev() {
  if (page.value <= 1) return;
  page.value -= 1;
  load();
}

function next() {
  if (page.value >= totalPages.value) return;
  page.value += 1;
  load();
}

function money(x: string): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}

function date(x: string | null): string {
  return x ? new Date(x).toLocaleDateString('ru-RU') : '—';
}

function open(id: number) {
  window.location.href = `/admin/customers/${id}`;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Поиск по email или телефону…"
        class="min-w-64 flex-1 rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      />
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
      <p class="text-subtle">Клиентов нет</p>
    </div>

    <!-- Table -->
    <template v-else>
      <div class="overflow-hidden rounded-2xl border-2 border-fill bg-white">
        <table class="w-full text-sm">
          <thead class="border-b-2 border-fill text-left text-subtle">
            <tr>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Телефон</th>
              <th class="px-4 py-3 font-medium">Заказов</th>
              <th class="px-4 py-3 font-medium">Потрачено</th>
              <th class="px-4 py-3 font-medium">Последний заказ</th>
              <th class="px-4 py-3 font-medium">Регистрация</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in items"
              :key="c.id"
              class="cursor-pointer border-b border-fill last:border-0 hover:bg-fill"
              @click="open(c.id)"
            >
              <td class="px-4 py-3 text-ink">
                <a
                  :href="`/admin/customers/${c.id}`"
                  class="font-medium text-primary hover:text-primary-hover"
                  @click.stop
                >
                  {{ c.email }}
                </a>
              </td>
              <td class="px-4 py-3 text-body">{{ c.phone || '—' }}</td>
              <td class="px-4 py-3 text-body">{{ c.orders_count }}</td>
              <td class="px-4 py-3 font-medium text-price">
                {{ money(c.total_spent) }}
              </td>
              <td class="px-4 py-3 text-body">
                {{ date(c.last_order_at ?? null) }}
              </td>
              <td class="px-4 py-3 text-body">{{ date(c.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-subtle">
          стр {{ page }} из {{ totalPages }}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="page <= 1"
            class="rounded-xl border-2 border-fill bg-white px-4 py-2 text-sm font-medium text-body transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
            @click="prev"
          >
            Назад
          </button>
          <button
            type="button"
            :disabled="page >= totalPages"
            class="rounded-xl border-2 border-fill bg-white px-4 py-2 text-sm font-medium text-body transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
            @click="next"
          >
            Вперёд
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
