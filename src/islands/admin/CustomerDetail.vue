<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { getCustomer, type CustomerDetail } from '../../api/admin';

const props = defineProps<{ customerId: number }>();

const customer = ref<CustomerDetail | null>(null);
const loading = ref(true);
const error = ref('');

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

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function paymentLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? status;
}

function money(x: string): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}

function date(x: string | null): string {
  return x ? new Date(x).toLocaleDateString('ru-RU') : '—';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    customer.value = await getCustomer(props.customerId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
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

    <template v-else-if="customer">
      <a
        href="/admin/customers"
        class="inline-block text-sm font-medium text-subtle hover:text-primary"
      >
        ← К списку клиентов
      </a>

      <!-- Profile -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-ink">{{ customer.email }}</h2>
            <p class="text-body">{{ customer.phone || '—' }}</p>
          </div>
          <span
            v-if="customer.is_active"
            class="rounded-lg bg-fill px-3 py-1 text-sm font-medium text-body"
          >
            Активен
          </span>
          <span
            v-else
            class="rounded-lg bg-badge-sale-bg px-3 py-1 text-sm font-medium text-badge-sale"
          >
            Заблокирован
          </span>
        </div>
        <dl class="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <div>
            <dt class="text-subtle">Регистрация</dt>
            <dd class="text-ink">{{ date(customer.created_at) }}</dd>
          </div>
          <div>
            <dt class="text-subtle">Баллы лояльности</dt>
            <dd class="text-ink">{{ customer.loyalty_points }}</dd>
          </div>
        </dl>
      </div>

      <!-- Stat cards -->
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-2xl font-semibold text-ink">
            {{ customer.orders_count }}
          </p>
          <p class="mt-1 text-sm text-subtle">Заказов</p>
        </div>
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-2xl font-semibold text-ink">
            {{ money(customer.total_spent) }}
          </p>
          <p class="mt-1 text-sm text-subtle">LTV</p>
        </div>
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-2xl font-semibold text-ink">
            {{ date(customer.last_order_at ?? null) }}
          </p>
          <p class="mt-1 text-sm text-subtle">Последний заказ</p>
        </div>
      </div>

      <!-- Addresses -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <h3 class="text-lg font-semibold text-ink">Адреса</h3>
        <p
          v-if="!customer.addresses || customer.addresses.length === 0"
          class="mt-3 text-sm text-subtle"
        >
          Адресов нет
        </p>
        <ul v-else class="mt-4 space-y-3">
          <li
            v-for="a in customer.addresses"
            :key="a.id"
            class="rounded-xl border-2 border-fill p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium text-ink">{{ a.full_name }}</span>
              <span
                v-if="a.is_default"
                class="rounded-lg bg-fill px-2 py-0.5 text-xs font-medium text-body"
              >
                По умолчанию
              </span>
            </div>
            <p class="mt-1 text-sm text-body">
              {{ a.city }}, {{ a.street
              }}<template v-if="a.zip">, {{ a.zip }}</template>
            </p>
            <p class="text-sm text-subtle">{{ a.phone }}</p>
          </li>
        </ul>
      </div>

      <!-- Order history -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <h3 class="text-lg font-semibold text-ink">История заказов</h3>
        <p
          v-if="!customer.orders || customer.orders.length === 0"
          class="mt-3 text-sm text-subtle"
        >
          Заказов нет
        </p>
        <div
          v-else
          class="mt-4 overflow-hidden rounded-xl border-2 border-fill"
        >
          <table class="w-full text-sm">
            <thead class="border-b-2 border-fill text-left text-subtle">
              <tr>
                <th class="px-4 py-3 font-medium">Номер</th>
                <th class="px-4 py-3 font-medium">Дата</th>
                <th class="px-4 py-3 font-medium">Статус</th>
                <th class="px-4 py-3 font-medium">Оплата</th>
                <th class="px-4 py-3 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="o in customer.orders"
                :key="o.number"
                class="border-b border-fill last:border-0"
              >
                <td class="px-4 py-3">
                  <a
                    :href="`/admin/orders/${o.number}`"
                    class="font-mono font-medium text-primary hover:text-primary-hover"
                  >
                    {{ o.number }}
                  </a>
                </td>
                <td class="px-4 py-3 text-body">{{ date(o.created_at) }}</td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-lg bg-fill px-2 py-0.5 text-xs font-medium text-body"
                  >
                    {{ statusLabel(o.status) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-lg bg-fill px-2 py-0.5 text-xs font-medium text-body"
                  >
                    {{ paymentLabel(o.payment_status) }}
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-price">
                  {{ money(o.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
