<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCart } from '../api/cart';
import { CART_CHANGED } from '../lib/cart-events';

const count = ref(0);

async function refresh() {
  try {
    count.value = (await getCart()).item_count ?? 0;
  } catch {
    count.value = 0;
  }
}

onMounted(() => {
  refresh();
  window.addEventListener(CART_CHANGED, refresh);
});
onUnmounted(() => window.removeEventListener(CART_CHANGED, refresh));
</script>

<template>
  <span
    v-if="count > 0"
    class="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-white"
    >{{ count }}</span
  >
</template>
