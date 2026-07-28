<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { search, type SearchHit } from '../api/search';
import { price } from '../lib/format';
import { localePath, type Lang } from '../lib/i18n';
import { ui } from '../lib/i18n-strings';
import { webpSrcset } from '../lib/img';

const props = defineProps<{ lang: Lang }>();
const t = ui(props.lang);

const q = ref('');
const results = ref<SearchHit[]>([]);
const open = ref(false);
const loading = ref(false);
const error = ref(false);
const root = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

function onInput() {
  clearTimeout(timer);
  const query = q.value.trim();
  if (query.length < 2) {
    results.value = [];
    error.value = false;
    open.value = false;
    return;
  }
  loading.value = true;
  // debounce so typing doesn't spam the API
  timer = setTimeout(async () => {
    try {
      const res = await search(query, props.lang, 1);
      results.value = (res.data ?? []).slice(0, 6);
      error.value = false;
      open.value = true;
    } catch {
      // Surface a failed search instead of an empty dropdown that reads as
      // "no results".
      results.value = [];
      error.value = true;
      open.value = true;
    } finally {
      loading.value = false;
    }
  }, 250);
}

function submit() {
  const query = q.value.trim();
  if (query)
    location.href = localePath(
      props.lang,
      `search?q=${encodeURIComponent(query)}`,
    );
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <form
    ref="root"
    class="relative flex h-12 flex-1 items-center gap-2 rounded-[10px] bg-fill px-4"
    @submit.prevent="submit"
  >
    <svg
      class="h-5 w-5 text-subtle"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" stroke-linecap="round" />
    </svg>
    <input
      v-model="q"
      type="search"
      :placeholder="t.searchPlaceholder"
      class="w-full bg-transparent text-body outline-none placeholder:text-subtle"
      @input="onInput"
      @focus="open = results.length > 0"
    />

    <div
      v-if="open && results.length"
      class="absolute left-0 top-14 z-20 w-full rounded-xl border-2 border-fill bg-white p-2 shadow-lg"
    >
      <a
        v-for="hit in results"
        :key="hit.card.product_id"
        :href="localePath(props.lang, `p/${hit.card.slug}`)"
        class="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-fill"
      >
        <picture v-if="hit.card.main_image_url">
          <source
            type="image/webp"
            :srcset="webpSrcset(hit.card.main_image_url)"
            sizes="32px"
          />
          <img
            :src="hit.card.main_image_url"
            alt=""
            class="h-8 w-8 shrink-0 object-contain"
          />
        </picture>
        <span class="flex-1 truncate text-sm text-ink">{{
          hit.card.name
        }}</span>
        <span class="text-sm font-semibold text-price">{{
          price(hit.card.price)
        }}</span>
      </a>
      <button
        type="submit"
        class="mt-1 w-full rounded-lg py-1.5 text-center text-sm font-medium text-primary hover:bg-fill"
      >
        {{ t.searchAllResults }}
      </button>
    </div>

    <div
      v-else-if="open && error"
      class="absolute left-0 top-14 z-20 w-full rounded-xl border-2 border-fill bg-white p-3 text-sm text-danger shadow-lg"
    >
      {{ t.searchError }}
    </div>
  </form>
</template>
