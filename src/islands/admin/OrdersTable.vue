<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { listOrders, type OrderFilters, type OrderOut } from '../../api/admin';

// --------------------------------------------------------------------------- //
// Status → Russian label + badge palette
// --------------------------------------------------------------------------- //
const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  done: 'Выполнен',
  canceled: 'Отменён',
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  paid: 'Оплачен',
  refunded: 'Возврат',
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}
function paymentLabel(s: string): string {
  return PAYMENT_LABELS[s] ?? s;
}

const BADGE_BASE = 'rounded-full px-2 py-0.5 text-xs font-medium';
function statusBadge(s: string): string {
  switch (s) {
    case 'new':
      return `${BADGE_BASE} bg-primary/10 text-primary`;
    case 'confirmed':
      return `${BADGE_BASE} bg-badge-sale-bg text-badge-sale`;
    case 'done':
      return `${BADGE_BASE} bg-price/10 text-price`;
    case 'canceled':
      return `${BADGE_BASE} bg-danger/10 text-danger`;
    default:
      return `${BADGE_BASE} bg-fill text-body`;
  }
}
function paymentBadge(s: string): string {
  switch (s) {
    case 'pending':
      return `${BADGE_BASE} bg-fill text-subtle`;
    case 'paid':
      return `${BADGE_BASE} bg-badge-sale-bg text-badge-sale`;
    case 'refunded':
      return `${BADGE_BASE} bg-danger/10 text-danger`;
    default:
      return `${BADGE_BASE} bg-fill text-body`;
  }
}

// --------------------------------------------------------------------------- //
// State
// --------------------------------------------------------------------------- //
const orders = ref<OrderOut[]>([]);
const total = ref(0);
const loading = ref(true);
const error = ref('');

const statusFilter = ref('');
const search = ref('');
const page = ref(1);
const pageSize = ref(20);

function buildFilters(): OrderFilters {
  const filters: OrderFilters = { page: page.value, page_size: pageSize.value };
  if (statusFilter.value) filters.status = statusFilter.value;
  const term = search.value.trim();
  if (term) filters.q = term;
  return filters;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listOrders(buildFilters());
    orders.value = res.data;
    total.value = res.total;
    page.value = res.page;
    pageSize.value = res.page_size;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// Filter changes reset to the first page and re-query.
watch(statusFilter, () => {
  page.value = 1;
  load();
});

// Debounce free-text search so we don't hammer the API per keystroke.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    load();
  }, 300);
});

const isEmpty = computed(
  () => !loading.value && !error.value && orders.value.length === 0,
);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value)),
);
const canPrev = computed(() => page.value > 1 && !loading.value);
const canNext = computed(() => page.value < totalPages.value && !loading.value);

function prev() {
  if (!canPrev.value) return;
  page.value -= 1;
  load();
}
function next() {
  if (!canNext.value) return;
  page.value += 1;
  load();
}

function money(x: string): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}
function formatDate(x: string): string {
  return new Date(x).toLocaleString('ru-RU');
}

function open(number: string) {
  window.location.href = `/admin/orders/${number}`;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <select
        v-model="statusFilter"
        class="rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      >
        <option value="">Все статусы</option>
        <option value="new">Новый</option>
        <option value="confirmed">Подтверждён</option>
        <option value="done">Выполнен</option>
        <option value="canceled">Отменён</option>
      </select>
      <input
        v-model="search"
        type="search"
        placeholder="Поиск по номеру, email или телефону…"
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
      <p class="text-subtle">Заказов нет</p>
    </div>

    <!-- Table -->
    <template v-else>
      <div class="overflow-hidden rounded-2xl border-2 border-fill bg-white">
        <table class="w-full text-sm">
          <thead class="border-b-2 border-fill text-left text-subtle">
            <tr>
              <th class="px-4 py-3 font-medium">Номер</th>
              <th class="px-4 py-3 font-medium">Дата</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Статус</th>
              <th class="px-4 py-3 font-medium">Оплата</th>
              <th class="px-4 py-3 text-right font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="o in orders"
              :key="o.number"
              class="cursor-pointer border-b border-fill last:border-0 hover:bg-fill"
              @click="open(o.number)"
            >
              <td class="px-4 py-3 font-mono font-medium text-ink">
                {{ o.number }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-body">
                {{ formatDate(o.created_at) }}
              </td>
              <td class="px-4 py-3 text-body">{{ o.email }}</td>
              <td class="px-4 py-3">
                <span :class="statusBadge(o.status)">
                  {{ statusLabel(o.status) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="paymentBadge(o.payment_status)">
                  {{ paymentLabel(o.payment_status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-medium text-price">
                {{ money(o.total) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-subtle">стр {{ page }} из {{ totalPages }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="!canPrev"
            class="rounded-xl border-2 border-fill px-4 py-2 font-medium text-body enabled:hover:border-primary disabled:opacity-40"
            @click="prev"
          >
            Назад
          </button>
          <button
            type="button"
            :disabled="!canNext"
            class="rounded-xl border-2 border-fill px-4 py-2 font-medium text-body enabled:hover:border-primary disabled:opacity-40"
            @click="next"
          >
            Вперёд
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
