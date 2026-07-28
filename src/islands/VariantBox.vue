<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';

import { addToCart } from '../api/cart';
import { notifyCartChanged } from '../lib/cart-events';
import { notifyVariantImage } from '../lib/variant-events';
import { price, discountPercent } from '../lib/format';
import type { Lang } from '../lib/i18n';
import { ui, pdpStrings } from '../lib/i18n-strings';
import type { components } from '../types/api';

type VariantOut = components['schemas']['VariantOut'];
type VariationAttributeOut = components['schemas']['VariationAttributeOut'];

const props = defineProps<{
  productId: number;
  variants: VariantOut[];
  variationAttributes: VariationAttributeOut[];
  priceMin: string;
  priceMax: string | null;
  lang: Lang;
}>();

const t = ui(props.lang);
const tp = pdpStrings(props.lang);

// attribute_id -> chosen value_id (null until picked).
const selected = reactive<Record<number, number | null>>(
  Object.fromEntries(
    props.variationAttributes.map((a) => [a.attribute_id, null]),
  ),
);

const qty = ref(1);
const state = ref<'idle' | 'loading' | 'done' | 'error'>('idle');

const selectedValueIds = computed(() =>
  props.variationAttributes
    .map((a) => selected[a.attribute_id])
    .filter((v): v is number => v != null),
);

const allChosen = computed(
  () => selectedValueIds.value.length === props.variationAttributes.length,
);

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

// The variant matching the full current selection (null while incomplete).
const selectedVariant = computed<VariantOut | null>(() => {
  if (!allChosen.value) return null;
  return (
    props.variants.find((v) =>
      sameSet(v.value_ids ?? [], selectedValueIds.value),
    ) ?? null
  );
});

// A value is selectable when some variant carries it AND is compatible with the
// values already chosen for the OTHER attributes (WooCommerce-style narrowing).
function optionEnabled(attributeId: number, valueId: number): boolean {
  const others = props.variationAttributes
    .filter((a) => a.attribute_id !== attributeId)
    .map((a) => selected[a.attribute_id])
    .filter((v): v is number => v != null);
  return props.variants.some((v) => {
    const ids = v.value_ids ?? [];
    return ids.includes(valueId) && others.every((o) => ids.includes(o));
  });
}

function pick(attributeId: number, valueId: number): void {
  selected[attributeId] = selected[attributeId] === valueId ? null : valueId;
}

const displayPrice = computed(() =>
  selectedVariant.value ? selectedVariant.value.price : props.priceMin,
);
const displayOldPrice = computed(() =>
  selectedVariant.value ? (selectedVariant.value.old_price ?? null) : null,
);
const salePercent = computed(() =>
  displayOldPrice.value
    ? discountPercent(displayOldPrice.value, displayPrice.value)
    : 0,
);
// Show "from" / a range only before a concrete variant is picked.
const showFrom = computed(
  () =>
    !selectedVariant.value &&
    props.priceMax != null &&
    props.priceMax !== props.priceMin,
);
const inStock = computed(() =>
  selectedVariant.value
    ? selectedVariant.value.in_stock
    : props.variants.some((v) => v.in_stock),
);
const canBuy = computed(
  () => !!selectedVariant.value && selectedVariant.value.in_stock,
);

// Swap the gallery main image to the chosen variant's photo (P4 decision: yes).
watch(selectedVariant, (v) => notifyVariantImage(v?.image_url ?? null));

async function add(): Promise<void> {
  if (!canBuy.value || state.value === 'loading') return;
  state.value = 'loading';
  try {
    await addToCart(
      props.productId,
      qty.value,
      props.lang,
      selectedVariant.value!.id,
    );
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
    <!-- Price: from/range before selection, exact variant price after -->
    <div class="mt-5 flex items-baseline gap-3">
      <span v-if="showFrom" class="text-sm text-subtle">{{
        tp.priceFrom
      }}</span>
      <span class="text-3xl font-semibold text-price">{{
        price(displayPrice)
      }}</span>
      <span v-if="displayOldPrice" class="text-lg text-subtle line-through">{{
        price(displayOldPrice)
      }}</span>
      <span
        v-if="salePercent > 0"
        class="rounded-lg bg-badge-sale-bg px-2 py-1 text-sm font-semibold text-badge-sale"
        >-{{ salePercent }}%</span
      >
    </div>
    <div class="mt-2 text-sm" :class="inStock ? 'text-price' : 'text-subtle'">
      {{ inStock ? t.inStock : t.outOfStock }}
    </div>

    <!-- Variation selectors -->
    <div class="mt-5 space-y-4">
      <div v-for="attr in variationAttributes" :key="attr.attribute_id">
        <div class="text-sm font-medium text-ink">
          {{ tp.chooseOption }} {{ attr.name }}
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="val in attr.values"
            :key="val.value_id"
            type="button"
            :disabled="!optionEnabled(attr.attribute_id, val.value_id)"
            class="rounded-xl border-2 px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="
              selected[attr.attribute_id] === val.value_id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-fill text-ink hover:border-primary'
            "
            @click="pick(attr.attribute_id, val.value_id)"
          >
            {{ val.value }}
          </button>
        </div>
      </div>
    </div>

    <!-- Quantity + add to cart -->
    <div class="mt-6">
      <div class="flex items-center gap-4">
        <div class="flex h-12 items-center rounded-xl border-2 border-fill">
          <button
            type="button"
            class="px-3 text-lg text-subtle"
            :aria-label="lang === 'ru' ? 'Уменьшить количество' : 'Micșorează cantitatea'"
            @click="qty = Math.max(1, qty - 1)"
          >
            −
          </button>
          <span class="w-8 text-center">{{ qty }}</span>
          <button
            type="button"
            class="px-3 text-lg text-subtle"
            :aria-label="lang === 'ru' ? 'Увеличить количество' : 'Mărește cantitatea'"
            @click="qty++"
          >
            +
          </button>
        </div>
        <button
          type="button"
          :disabled="!canBuy || state === 'loading'"
          class="h-12 flex-1 rounded-xl bg-primary font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
          @click="add"
        >
          {{
            state === 'done'
              ? tp.addedToCart
              : state === 'loading'
                ? '…'
                : !allChosen
                  ? tp.selectToBuy
                  : !inStock
                    ? t.outOfStock
                    : t.addToCart
          }}
        </button>
      </div>
      <p v-if="state === 'error'" class="mt-2 text-sm text-danger">
        {{ tp.addToCartError }}
      </p>
    </div>
  </div>
</template>
