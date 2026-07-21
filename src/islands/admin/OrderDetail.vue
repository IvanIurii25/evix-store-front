<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { getOrder, transitionOrder, type OrderOut } from '../../api/admin';

const props = defineProps<{ number: string }>();

// --------------------------------------------------------------------------- //
// Status machine — labels + legal transitions
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

// Fulfilment: new → confirmed|canceled ; confirmed → done|canceled ; else terminal.
const STATUS_NEXT: Record<string, string[]> = {
  new: ['confirmed', 'canceled'],
  confirmed: ['done', 'canceled'],
  done: [],
  canceled: [],
};
// Payment: pending → paid ; paid → refunded ; else terminal.
const PAYMENT_NEXT: Record<string, string[]> = {
  pending: ['paid'],
  paid: ['refunded'],
  refunded: [],
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
const order = ref<OrderOut | null>(null);
const loading = ref(true);
const error = ref('');
const busy = ref(false);

// Toast — success (ok) or failure message.
const toast = ref<{ text: string; ok: boolean } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(text: string, ok: boolean) {
  toast.value = { text, ok };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 3500);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    order.value = await getOrder(props.number);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Заказ не найден';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const nextStatuses = computed(() =>
  order.value ? (STATUS_NEXT[order.value.status] ?? []) : [],
);
const nextPayments = computed(() =>
  order.value ? (PAYMENT_NEXT[order.value.payment_status] ?? []) : [],
);

async function changeStatus(to: string) {
  await apply({ to_status: to }, `Статус изменён: ${statusLabel(to)}`);
}
async function changePayment(to: string) {
  await apply(
    { to_payment_status: to },
    `Оплата изменена: ${paymentLabel(to)}`,
  );
}

async function apply(
  body: { to_status?: string | null; to_payment_status?: string | null },
  okText: string,
) {
  if (busy.value) return;
  busy.value = true;
  try {
    order.value = await transitionOrder(props.number, body);
    showToast(okText, true);
  } catch (e) {
    showToast(
      e instanceof Error ? e.message : 'Не удалось выполнить переход',
      false,
    );
  } finally {
    busy.value = false;
  }
}

function money(x: string): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}
function formatDate(x: string): string {
  return new Date(x).toLocaleString('ru-RU');
}
function lineTotal(price: string, qty: number): string {
  return money(String(Number(price) * qty));
}

const isCourier = computed(() => {
  const t = order.value?.delivery_type ?? '';
  return t.toLowerCase() === 'courier';
});
</script>

<template>
  <div class="space-y-4">
    <a
      href="/admin/orders"
      class="inline-block text-sm font-medium text-primary hover:text-primary-hover"
    >
      ← К заказам
    </a>

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

    <template v-else-if="order">
      <!-- Header: number + current badges -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="font-mono text-xl font-bold text-ink">
              Заказ {{ order.number }}
            </h2>
            <p class="mt-1 text-sm text-subtle">
              {{ formatDate(order.created_at) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span :class="statusBadge(order.status)">
              {{ statusLabel(order.status) }}
            </span>
            <span :class="paymentBadge(order.payment_status)">
              {{ paymentLabel(order.payment_status) }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Customer -->
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h3 class="mb-3 font-semibold text-ink">Клиент</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-subtle">Email</dt>
              <dd class="text-body">{{ order.email }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-subtle">Телефон</dt>
              <dd class="text-body">{{ order.phone }}</dd>
            </div>
          </dl>
        </div>

        <!-- Delivery + payment -->
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h3 class="mb-3 font-semibold text-ink">Доставка и оплата</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-subtle">Тип доставки</dt>
              <dd class="text-body">{{ order.delivery_type }}</dd>
            </div>
            <template v-if="isCourier">
              <div
                v-if="order.delivery_name"
                class="flex justify-between gap-4"
              >
                <dt class="text-subtle">Получатель</dt>
                <dd class="text-body">{{ order.delivery_name }}</dd>
              </div>
              <div
                v-if="order.delivery_city"
                class="flex justify-between gap-4"
              >
                <dt class="text-subtle">Город</dt>
                <dd class="text-body">{{ order.delivery_city }}</dd>
              </div>
              <div
                v-if="order.delivery_street"
                class="flex justify-between gap-4"
              >
                <dt class="text-subtle">Улица</dt>
                <dd class="text-body">{{ order.delivery_street }}</dd>
              </div>
              <div v-if="order.delivery_zip" class="flex justify-between gap-4">
                <dt class="text-subtle">Индекс</dt>
                <dd class="text-body">{{ order.delivery_zip }}</dd>
              </div>
            </template>
            <div class="flex justify-between gap-4">
              <dt class="text-subtle">Способ оплаты</dt>
              <dd class="text-body">{{ order.payment_method }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Items -->
      <div class="overflow-hidden rounded-2xl border-2 border-fill bg-white">
        <table class="w-full text-sm">
          <thead class="border-b-2 border-fill text-left text-subtle">
            <tr>
              <th class="px-4 py-3 font-medium">Товар</th>
              <th class="px-4 py-3 text-right font-medium">Кол-во</th>
              <th class="px-4 py-3 text-right font-medium">Цена</th>
              <th class="px-4 py-3 text-right font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(it, idx) in order.items"
              :key="idx"
              class="border-b border-fill last:border-0"
            >
              <td class="px-4 py-3 text-ink">{{ it.name_snapshot }}</td>
              <td class="px-4 py-3 text-right text-body">{{ it.qty }}</td>
              <td class="px-4 py-3 text-right text-body">
                {{ money(it.price_snapshot) }}
              </td>
              <td class="px-4 py-3 text-right font-medium text-price">
                {{ lineTotal(it.price_snapshot, it.qty) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <dl class="ml-auto max-w-sm space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-subtle">Подытог</dt>
            <dd class="text-body">{{ money(order.subtotal) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-subtle">Скидка</dt>
            <dd class="text-body">−{{ money(order.discount_total) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-subtle">Доставка</dt>
            <dd class="text-body">{{ money(order.delivery_cost) }}</dd>
          </div>
          <div
            class="flex justify-between gap-4 border-t-2 border-fill pt-2 text-base font-semibold"
          >
            <dt class="text-ink">Итого</dt>
            <dd class="text-price">{{ money(order.total) }}</dd>
          </div>
        </dl>
      </div>

      <!-- Actions -->
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h3 class="mb-3 font-semibold text-ink">Статус заказа</h3>
          <div v-if="nextStatuses.length" class="flex flex-wrap gap-2">
            <button
              v-for="s in nextStatuses"
              :key="s"
              type="button"
              :disabled="busy"
              class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              @click="changeStatus(s)"
            >
              {{ statusLabel(s) }}
            </button>
          </div>
          <p v-else class="text-sm text-subtle">
            Финальный статус — переходов нет.
          </p>
        </div>

        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h3 class="mb-3 font-semibold text-ink">Оплата</h3>
          <div v-if="nextPayments.length" class="flex flex-wrap gap-2">
            <button
              v-for="p in nextPayments"
              :key="p"
              type="button"
              :disabled="busy"
              class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              @click="changePayment(p)"
            >
              {{ paymentLabel(p) }}
            </button>
          </div>
          <p v-else class="text-sm text-subtle">
            Финальный статус — переходов нет.
          </p>
        </div>
      </div>
    </template>

    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed right-6 bottom-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
      :class="toast.ok ? 'bg-badge-sale' : 'bg-danger'"
    >
      {{ toast.text }}
    </div>
  </div>
</template>
