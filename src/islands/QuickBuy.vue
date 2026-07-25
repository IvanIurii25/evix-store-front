<script setup lang="ts">
import { computed, ref } from 'vue';

import { quickBuy } from '../api/checkout';
import type { Lang } from '../lib/i18n';
import { quickBuyStrings } from '../lib/i18n-strings';

const props = defineProps<{
  productId: number;
  lang: Lang;
}>();

const t = quickBuyStrings(props.lang);

// Flow states: closed (only the trigger button) → open (form) → submitting →
// done (confirmation with the order number). `error` holds a localized message.
type State = 'closed' | 'open' | 'submitting' | 'done';
const state = ref<State>('closed');
const phone = ref('');
const name = ref('');
const error = ref('');
const orderNumber = ref('');

// Map a backend error code to a localized message.
function messageFor(code: string): string {
  if (code === 'out_of_stock') return t.errOutOfStock;
  if (code === 'product_not_found') return t.errNotFound;
  return t.errGeneric;
}

function openForm() {
  state.value = 'open';
  error.value = '';
}

function closeForm() {
  state.value = 'closed';
  error.value = '';
  phone.value = '';
  name.value = '';
}

async function submit() {
  if (state.value === 'submitting') return;
  if (phone.value.trim().length < 3) {
    error.value = t.errPhone;
    return;
  }
  state.value = 'submitting';
  error.value = '';
  const res = await quickBuy(
    {
      product_id: props.productId,
      phone: phone.value.trim(),
      name: name.value,
    },
    props.lang,
  );
  if (res.error || !res.data) {
    error.value = messageFor(res.error ?? 'generic');
    state.value = 'open';
    return;
  }
  orderNumber.value = res.data.number;
  state.value = 'done';
}

const showForm = computed(
  () => state.value === 'open' || state.value === 'submitting',
);
</script>

<template>
  <div>
    <!-- Secondary trigger: sits under the primary "В корзину" button. -->
    <button
      v-if="state === 'closed'"
      type="button"
      class="h-12 w-full rounded-xl border-2 border-primary font-medium text-primary transition hover:bg-primary hover:text-white"
      @click="openForm"
    >
      {{ t.trigger }}
    </button>

    <!-- Mini form: phone (required) + optional name, no registration/cart. -->
    <form
      v-else-if="showForm"
      class="rounded-xl border-2 border-fill p-4"
      novalidate
      @submit.prevent="submit"
    >
      <div class="mb-3 flex items-center justify-between">
        <span class="font-medium text-ink">{{ t.title }}</span>
        <button
          type="button"
          class="text-subtle transition hover:text-ink"
          :aria-label="t.close"
          @click="closeForm"
        >
          ✕
        </button>
      </div>
      <input
        v-model="phone"
        type="tel"
        required
        :placeholder="t.phone"
        :aria-label="t.phone"
        class="mb-2 h-11 w-full rounded-lg border border-fill px-3 outline-none focus:border-primary"
      />
      <input
        v-model="name"
        type="text"
        :placeholder="t.name"
        :aria-label="t.name"
        class="mb-3 h-11 w-full rounded-lg border border-fill px-3 outline-none focus:border-primary"
      />
      <button
        type="submit"
        :disabled="state === 'submitting'"
        class="h-12 w-full rounded-xl bg-primary font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
      >
        {{ state === 'submitting' ? t.submitting : t.submit }}
      </button>
      <p v-if="error" class="mt-2 text-sm text-danger">{{ error }}</p>
    </form>

    <!-- Confirmation: order accepted, we'll call back. -->
    <div
      v-else-if="state === 'done'"
      class="rounded-xl border-2 border-fill p-4"
    >
      <p class="text-ink">
        {{ t.successPre }}{{ orderNumber }} {{ t.successPost }}
      </p>
      <button
        type="button"
        class="mt-3 text-sm text-primary underline"
        @click="closeForm"
      >
        {{ t.close }}
      </button>
    </div>
  </div>
</template>
