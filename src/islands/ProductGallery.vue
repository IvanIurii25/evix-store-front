<script setup lang="ts">
import { ref } from 'vue';

import { webpSrcset } from '../lib/img';

const props = defineProps<{ images: { url: string }[]; alt: string }>();
const active = ref(props.images[0]?.url ?? '');
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
      <span v-else class="text-subtle">нет фото</span>
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
