<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

import { type Lang } from '../lib/i18n';
import { webpSrcset } from '../lib/img';
import { VARIANT_IMAGE } from '../lib/variant-events';

const props = defineProps<{
  images: { url: string }[];
  alt: string;
  lang?: Lang;
}>();
const fallback = props.images[0]?.url ?? '';
const active = ref(fallback);

// Variable products: switch the main image to the chosen variant's photo. A null
// url (deselected / no variant image) falls back to the first gallery image.
function onVariantImage(event: Event) {
  const url = (event as CustomEvent<{ url: string | null }>).detail?.url;
  active.value = url ?? fallback;
}
onMounted(() => window.addEventListener(VARIANT_IMAGE, onVariantImage));
onUnmounted(() => window.removeEventListener(VARIANT_IMAGE, onVariantImage));
</script>

<template>
  <div>
    <div
      class="flex aspect-square items-center justify-center rounded-2xl border-2 border-fill bg-white p-6"
    >
      <picture v-if="active">
        <source
          type="image/webp"
          :srcset="webpSrcset(active)"
          sizes="(min-width: 768px) 45vw, 90vw"
        />
        <img
          :src="active"
          :alt="alt"
          fetchpriority="high"
          decoding="async"
          class="max-h-full object-contain"
        />
      </picture>
      <span v-else class="text-subtle">{{
        lang === 'ru' ? 'нет фото' : 'fără imagine'
      }}</span>
    </div>

    <div v-if="images.length > 1" class="mt-4 flex gap-3">
      <button
        v-for="img in images"
        :key="img.url"
        type="button"
        class="h-20 w-20 rounded-lg border-2 p-1 transition"
        :class="active === img.url ? 'border-primary' : 'border-fill'"
        @click="active = img.url"
      >
        <picture>
          <source
            type="image/webp"
            :srcset="webpSrcset(img.url)"
            sizes="80px"
          />
          <img :src="img.url" alt="" class="h-full w-full object-contain" />
        </picture>
      </button>
    </div>
  </div>
</template>
