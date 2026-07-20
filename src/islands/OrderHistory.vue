<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { listOrders, type OrderOut } from '../api/account';
import { price } from '../lib/format';

const orders = ref<OrderOut[]>([]);
const loading = ref(true);

const STATUS: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  done: 'Выполнен',
  canceled: 'Отменён',
};

function fmtDate(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('ro-MD');
}

onMounted(async () => {
  orders.value = await listOrders();
  loading.value = false;
});
</script>

<template>
  <div>
    <div v-if="loading" class="text-subtle">Загрузка…</div>
    <p v-else-if="!orders.length" class="text-subtle">Заказов пока нет.</p>
    <ul v-else class="space-y-3">
      <li
        v-for="o in orders"
        :key="o.number"
        class="flex items-center justify-between gap-4 rounded-2xl border-2 border-fill p-4"
      >
        <div class="text-sm">
          <div class="font-medium text-ink">Заказ {{ o.number }}</div>
          <div class="text-subtle">
            {{ fmtDate(o.created_at) }} · {{ STATUS[o.status] ?? o.status }}
          </div>
        </div>
        <div class="text-right">
          <div class="font-semibold text-price">{{ price(o.total) }}</div>
          <div class="text-xs text-subtle">
            {{ o.payment_status === 'paid' ? 'оплачен' : 'ожидает оплаты' }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
