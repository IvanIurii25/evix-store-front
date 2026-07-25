<script setup lang="ts">
import { ref } from 'vue';
import { addToCart } from '../api/cart';
import { notifyCartChanged } from '../lib/cart-events';
import type { Lang } from '../lib/i18n';
import { ui, pdpStrings } from '../lib/i18n-strings';

const props = defineProps<{
  productId: number;
  inStock: boolean;
  lang: Lang;
}>();
const t = ui(props.lang);
const tp = pdpStrings(props.lang);

const qty = ref(1);
const state = ref<'idle' | 'loading' | 'done' | 'error'>('idle');

async function add() {
  if (!props.inStock || state.value === 'loading') return;
  state.value = 'loading';
  try {
    await addToCart(props.productId, qty.value);
    notifyCartChanged();
    state.value = 'done';
    setTimeout(() => (state.value = 'idle'), 2000);
  } catch {
    state.value = 'error';
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-4">
      <div class="flex h-12 items-center rounded-xl border-2 border-fill">
        <button
          type="button"
          class="px-3 text-lg text-subtle"
          @click="qty = Math.max(1, qty - 1)"
        >
          −
        </button>
        <span class="w-8 text-center">{{ qty }}</span>
        <button type="button" class="px-3 text-lg text-subtle" @click="qty++">
          +
        </button>
      </div>
      <button
        type="button"
        :disabled="!inStock || state === 'loading'"
        class="h-12 flex-1 rounded-xl bg-primary font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
        @click="add"
      >
        {{
          state === 'done'
            ? tp.addedToCart
            : state === 'loading'
              ? '…'
              : inStock
                ? t.addToCart
                : t.outOfStock
        }}
      </button>
    </div>
    <p v-if="state === 'error'" class="mt-2 text-sm text-danger">
      {{ tp.addToCartError }}
    </p>
  </div>
</template>
