<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCart, updateItem, removeItem, type CartOut } from '../api/cart';
import { price } from '../lib/format';
import { notifyCartChanged } from '../lib/cart-events';
import { localePath, type Lang } from '../lib/i18n';
import { cartStrings } from '../lib/i18n-strings';

const props = defineProps<{ lang: Lang }>();
const t = cartStrings(props.lang);

const cart = ref<CartOut>({ items: [], subtotal: '0', item_count: 0 });
const loading = ref(true);
const busy = ref(false);

async function load() {
  cart.value = await getCart();
  loading.value = false;
}

async function setQty(pid: number, qty: number) {
  if (busy.value) return;
  busy.value = true;
  try {
    if (qty < 1) await removeItem(pid);
    else await updateItem(pid, qty);
    await load();
    notifyCartChanged();
  } finally {
    busy.value = false;
  }
}

async function remove(pid: number) {
  if (busy.value) return;
  busy.value = true;
  try {
    await removeItem(pid);
    await load();
    notifyCartChanged();
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-if="loading" class="text-subtle">{{ t.loading }}</div>

  <div v-else-if="!cart.items || cart.items.length === 0" class="text-subtle">
    {{ t.empty }}
    <a :href="localePath(props.lang)" class="text-primary hover:underline">{{
      t.toCatalog
    }}</a>
  </div>

  <div v-else class="flex flex-col gap-6 lg:flex-row">
    <div class="flex-1 space-y-3">
      <div
        v-for="it in cart.items"
        :key="it.product_id"
        class="flex items-center gap-4 rounded-2xl border-2 border-fill p-4"
      >
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-ink">{{ it.name }}</div>
          <div class="text-sm text-subtle">
            {{ price(it.price) }} {{ t.perUnit }}
          </div>
        </div>
        <div
          class="flex h-10 shrink-0 items-center rounded-xl border-2 border-fill"
        >
          <button
            type="button"
            class="px-3 text-lg text-subtle"
            @click="setQty(it.product_id, it.qty - 1)"
          >
            −
          </button>
          <span class="w-8 text-center">{{ it.qty }}</span>
          <button
            type="button"
            class="px-3 text-lg text-subtle"
            @click="setQty(it.product_id, it.qty + 1)"
          >
            +
          </button>
        </div>
        <div class="w-24 shrink-0 text-right font-semibold text-price">
          {{ price(it.line_total) }}
        </div>
        <button
          type="button"
          class="shrink-0 text-subtle transition hover:text-danger"
          :aria-label="t.remove"
          @click="remove(it.product_id)"
        >
          ✕
        </button>
      </div>
    </div>

    <aside class="lg:w-80">
      <div class="rounded-2xl border-2 border-fill p-6">
        <div class="flex items-baseline justify-between">
          <span class="text-subtle">{{ t.total }}</span>
          <span class="text-2xl font-semibold text-price">{{
            price(cart.subtotal)
          }}</span>
        </div>
        <a
          :href="localePath(props.lang, 'checkout')"
          class="mt-5 block rounded-xl bg-primary py-3 text-center font-medium text-white transition hover:bg-primary-hover"
        >
          {{ t.checkout }}
        </a>
      </div>
    </aside>
  </div>
</template>
