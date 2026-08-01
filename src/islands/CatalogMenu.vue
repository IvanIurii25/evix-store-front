<script setup lang="ts">
// The header's catalog control. It stays a real link to the /c hub — the click
// handler only exists once this island has hydrated, so no-JS visitors, crawlers
// and pre-hydration clicks all land on the hub page instead of nothing. When the
// tree is empty (backend down) the click is not intercepted either.
//
// One panel serves both layouts: an off-canvas drawer below `md`, a full-width
// dropdown under the header from `md` up.
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { localePath, type Lang } from '../lib/i18n';
import { ui, catalogStrings } from '../lib/i18n-strings';
import type { CategoryNode } from '../api/catalog';

const props = defineProps<{ lang: Lang; categories: CategoryNode[] }>();

const t = ui(props.lang);
const tc = catalogStrings(props.lang);
const hubHref = localePath(props.lang, 'c');

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const trigger = ref<HTMLAnchorElement | null>(null);

// Same rule as the hub page: a category with nothing in it is a dead end.
const groups = computed(() =>
  props.categories
    .filter((c) => c.product_count > 0)
    .map((cat) => ({
      cat,
      children: (cat.children ?? []).filter((c) => c.product_count > 0),
    })),
);

function catHref(slug: string): string {
  return localePath(props.lang, `c/${slug}`);
}

function isDrawer(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches
  );
}

// The drawer covers the page, so the page behind it must not scroll. The
// desktop dropdown leaves scrolling alone — a wheel that does nothing reads as
// a broken page.
function lockScroll(lock: boolean) {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = lock ? 'hidden' : '';
}

async function show() {
  open.value = true;
  if (isDrawer()) lockScroll(true);
  await nextTick();
  panel.value?.querySelector('a')?.focus();
}

function close(returnFocus = false) {
  if (!open.value) return;
  open.value = false;
  lockScroll(false);
  if (returnFocus) trigger.value?.focus();
}

function onTriggerClick(event: MouseEvent) {
  // Nothing to show → let the browser follow the link to the hub.
  if (groups.value.length === 0) return;
  event.preventDefault();
  if (open.value) close();
  else void show();
}

function onDocClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true);
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKeydown);
  lockScroll(false);
});
</script>

<template>
  <div ref="root" class="shrink-0">
    <a
      ref="trigger"
      :href="hubHref"
      :aria-label="t.catalog"
      :aria-expanded="open"
      aria-haspopup="true"
      aria-controls="catalog-menu-panel"
      class="flex h-12 shrink-0 items-center gap-2 rounded-[10px] bg-primary px-3 font-semibold text-white transition hover:bg-primary-hover md:px-5"
      @click="onTriggerClick"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          v-if="open"
          d="M6 6l12 12M18 6L6 18"
          stroke-linecap="round"
        ></path>
        <path v-else d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"></path>
      </svg>
      <span class="hidden md:inline">{{ t.catalog }}</span>
    </a>

    <div
      v-if="open"
      class="fixed inset-0 z-30 bg-black/30 md:top-20"
      @click="close()"
    ></div>

    <div
      v-if="open"
      id="catalog-menu-panel"
      ref="panel"
      class="fixed inset-y-0 left-0 z-40 w-[86%] max-w-sm overflow-y-auto bg-white p-5 shadow-xl md:inset-x-0 md:inset-y-auto md:top-20 md:max-h-[72vh] md:w-full md:max-w-none md:p-0 md:shadow-lg"
    >
      <div
        class="mb-4 flex items-center justify-between md:mx-auto md:max-w-[1360px] md:px-5 md:pt-6"
      >
        <span class="text-lg font-bold text-ink">{{ tc.title }}</span>
        <button
          type="button"
          class="rounded-lg p-1 text-subtle transition hover:text-primary md:hidden"
          :aria-label="tc.close"
          @click="close(true)"
        >
          <svg
            class="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"></path>
          </svg>
        </button>
      </div>

      <!-- Column flow, not a grid: groups differ in height (8 children under
           «Дом», none under «Спорт»), and grid rows align to the tallest one,
           leaving holes under the short groups. Columns pack them continuously;
           break-inside keeps a group whole. -->
      <div
        class="md:mx-auto md:max-w-[1360px] md:columns-2 md:gap-8 md:px-5 md:pb-8 lg:columns-3"
      >
        <section
          v-for="group in groups"
          :key="group.cat.id"
          class="mb-6 break-inside-avoid last:mb-0 md:mb-7"
        >
          <a
            :href="catHref(group.cat.slug)"
            class="block font-bold text-ink transition hover:text-primary"
          >
            {{ group.cat.name }}
            <span class="ml-1 text-sm font-normal text-subtle">{{
              group.cat.product_count
            }}</span>
          </a>
          <ul v-if="group.children.length > 0" class="mt-2 space-y-1.5">
            <li v-for="child in group.children" :key="child.id">
              <a
                :href="catHref(child.slug)"
                class="flex items-baseline justify-between gap-3 text-sm text-body transition hover:text-primary"
              >
                <span>{{ child.name }}</span>
                <span class="shrink-0 text-subtle">{{
                  child.product_count
                }}</span>
              </a>
            </li>
          </ul>
        </section>
      </div>

      <a
        :href="hubHref"
        class="mt-6 block font-semibold text-primary hover:underline md:mx-auto md:max-w-[1360px] md:px-5 md:pb-8"
      >
        {{ tc.allCategories }} →
      </a>
    </div>
  </div>
</template>
