<script setup lang="ts">
import { price } from '../lib/format';
import type { ProductCard } from '../api/catalog';
import { localePath, type Lang } from '../lib/i18n';

const props = defineProps<{ product: ProductCard; lang: Lang }>();
</script>

<template>
  <a
    :href="localePath(props.lang, `p/${product.slug}`)"
    class="group flex flex-col rounded-2xl border-2 border-fill bg-white p-4 transition hover:shadow-[0_6px_24px_rgba(0,0,0,0.15)]"
  >
    <div class="relative flex h-56 items-center justify-center overflow-hidden">
      <span
        v-if="product.badge"
        class="absolute left-0 top-0 rounded-md bg-badge-sale-bg px-2 py-0.5 text-xs font-medium text-badge-sale"
        >{{ product.badge }}</span
      >
      <img
        v-if="product.main_image_url"
        :src="product.main_image_url"
        :alt="product.name"
        loading="lazy"
        class="max-h-full object-contain"
      />
      <span v-else class="text-sm text-subtle">нет фото</span>
    </div>

    <h3 class="mt-3 line-clamp-2 text-sm font-semibold text-ink">
      {{ product.name }}
    </h3>

    <div class="mt-auto pt-3">
      <div class="flex items-baseline gap-2">
        <span class="text-xl font-semibold text-price">{{
          price(product.price)
        }}</span>
        <span
          v-if="product.old_price"
          class="text-sm text-subtle line-through"
          >{{ price(product.old_price) }}</span
        >
      </div>
      <div
        class="mt-1 text-xs"
        :class="product.in_stock ? 'text-price' : 'text-subtle'"
      >
        {{ product.in_stock ? 'В наличии' : 'Нет в наличии' }}
      </div>
      <span
        class="mt-3 block rounded-xl bg-primary py-2 text-center text-sm font-medium text-white transition group-hover:bg-primary-hover"
        >В корзину</span
      >
    </div>
  </a>
</template>
