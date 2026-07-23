<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { localePath, type Lang } from '../lib/i18n';
import { price as fmtPrice } from '../lib/format';

interface Card {
  slug: string;
  name: string;
  image: string | null;
  price: string;
}

const props = defineProps<{ current: Card; lang: Lang }>();

const KEY = 'evix_recently_viewed';
const MAX = 12;
const items = ref<Card[]>([]);

// The stored `image` is the original media URL; a small WebP variant exists
// alongside it (see the media pipeline).
function thumb(url: string | null): string | null {
  return url ? url.replace(/\.[^./]+$/, '_200.webp') : null;
}

onMounted(() => {
  let list: Card[] = [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) list = JSON.parse(raw);
  } catch {
    /* corrupt/unavailable storage — keep the empty list */
  }
  // Record the current product: prepend, dedupe by slug, cap the history.
  list = [props.current, ...list.filter((c) => c.slug !== props.current.slug)].slice(
    0,
    MAX,
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota — non-fatal */
  }
  // Show everything except the product being viewed.
  items.value = list.filter((c) => c.slug !== props.current.slug);
});
</script>

<template>
  <section v-if="items.length" class="mx-auto max-w-[1360px] px-5 pt-14">
    <h2 class="mb-5 text-xl font-bold text-ink">
      {{ lang === 'ru' ? 'Вы смотрели' : 'Ați vizualizat' }}
    </h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      <a
        v-for="c in items"
        :key="c.slug"
        :href="localePath(lang, `p/${c.slug}`)"
        class="group flex flex-col rounded-2xl border-2 border-fill bg-white p-3 transition hover:shadow-[0_6px_24px_rgba(0,0,0,0.12)]"
      >
        <div class="flex h-32 items-center justify-center overflow-hidden">
          <picture v-if="thumb(c.image)">
            <source type="image/webp" :srcset="thumb(c.image)!" />
            <img
              :src="c.image!"
              alt=""
              loading="lazy"
              class="max-h-full object-contain"
            />
          </picture>
          <span v-else class="text-xs text-subtle">нет фото</span>
        </div>
        <h3 class="mt-2 line-clamp-2 text-xs font-medium text-ink">{{ c.name }}</h3>
        <span class="mt-1 text-sm font-semibold text-price">{{
          fmtPrice(c.price)
        }}</span>
      </a>
    </div>
  </section>
</template>
