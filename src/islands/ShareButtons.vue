<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import type { Lang } from '../lib/i18n';
import { shareStrings } from '../lib/i18n-strings';

// Social-share block for the PDP. `url` is the absolute canonical of the current
// product (built SSR-side from Astro.site); `name` is the product title. Social
// networks are plain <a> links; only "copy link" needs the client (clipboard),
// which is why the whole block is a client:visible island.
const props = defineProps<{
  url: string;
  name: string;
  lang: Lang;
}>();

const t = shareStrings(props.lang);

const encodedUrl = computed(() => encodeURIComponent(props.url));
const encodedName = computed(() => encodeURIComponent(props.name));

const facebookHref = computed(
  () => `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl.value}`,
);
const telegramHref = computed(
  () =>
    `https://t.me/share/url?url=${encodedUrl.value}&text=${encodedName.value}`,
);
const whatsappHref = computed(
  () => `https://wa.me/?text=${encodedName.value}%20${encodedUrl.value}`,
);
const viberHref = computed(
  () => `viber://forward?text=${encodedName.value}%20${encodedUrl.value}`,
);

// Transient toast: "Copiat ✓" on success, a fallback message otherwise.
const toast = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

function flash(message: string) {
  toast.value = message;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    toast.value = '';
  }, 2000);
}

async function copyLink() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.url);
      flash(t.copied);
      return;
    }
    flash(t.copyFailed);
  } catch {
    flash(t.copyFailed);
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="mt-6">
    <div class="mb-2 text-sm font-medium text-subtle">{{ t.title }}</div>
    <div class="flex flex-wrap items-center gap-2">
      <a
        :href="facebookHref"
        target="_blank"
        rel="noopener"
        :title="t.facebook"
        :aria-label="t.facebook"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-fill text-subtle transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.5-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.2H7.6V13h2.5v8h3.4z"
          />
        </svg>
      </a>
      <a
        :href="telegramHref"
        target="_blank"
        rel="noopener"
        :title="t.telegram"
        :aria-label="t.telegram"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-fill text-subtle transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M21.5 4.3 2.9 11.5c-.9.35-.9 1.6.05 1.9l4.6 1.4 1.75 5.4c.25.75 1.2.9 1.65.25l2.4-2.85 4.55 3.35c.6.45 1.45.1 1.6-.6l3.05-14.6c.2-.9-.7-1.65-1.55-1.35zM9.5 14.6l8.4-5.3-6.9 6.4c-.15.15-.25.35-.3.55l-.25 2-.95-3.65z"
          />
        </svg>
      </a>
      <a
        :href="whatsappHref"
        target="_blank"
        rel="noopener"
        :title="t.whatsapp"
        :aria-label="t.whatsapp"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-fill text-subtle transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.26A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 6.9 12.6l.02.03-.9 3.28-3.36-.88-.2.12A8.2 8.2 0 1 1 12 3.8zm-3.1 4.1c-.15 0-.4.06-.6.3-.2.24-.78.77-.78 1.87s.8 2.17.9 2.32c.12.15 1.57 2.5 3.9 3.4 1.94.75 2.34.6 2.76.56.42-.04 1.36-.55 1.55-1.1.2-.53.2-.98.14-1.08-.06-.1-.22-.15-.46-.27-.24-.12-1.36-.67-1.57-.74-.2-.08-.36-.12-.5.12-.15.24-.57.74-.7.9-.13.14-.26.16-.5.05-.24-.12-1-.37-1.9-1.18-.7-.62-1.17-1.4-1.3-1.64-.13-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.15.16-.25.24-.42.08-.16.04-.3-.02-.42-.06-.12-.5-1.28-.7-1.75-.18-.44-.36-.38-.5-.39z"
          />
        </svg>
      </a>
      <a
        :href="viberHref"
        target="_blank"
        rel="noopener"
        :title="t.viber"
        :aria-label="t.viber"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-fill text-subtle transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 2C7.5 2 3.4 3.2 3.4 8.6v6.2c0 1.9 1 3.2 2.3 4.05v2.4c0 .55.66.83 1.05.44l1.9-1.9c1.05.2 2.15.31 3.35.31 4.5 0 8.6-1.2 8.6-6.6V8.6C20.6 3.2 16.5 2 12 2zm3.7 10.9c-.16.35-.9.75-1.3.8-.35.05-.4.32-2.55-.65-1.8-.9-2.9-2.75-3-2.9-.1-.15-.7-1-.7-1.9 0-.9.47-1.33.63-1.5.16-.18.35-.22.47-.22h.34c.11 0 .27-.04.42.32.15.37.5 1.28.55 1.37.04.09.07.2 0 .32-.06.12-.1.2-.19.3l-.28.33c-.09.09-.19.19-.08.37.1.18.47.77 1 1.25.7.62 1.28.81 1.46.9.18.09.28.08.39-.05.1-.13.44-.52.56-.7.11-.18.23-.15.39-.09.16.06 1.02.48 1.2.57.18.09.3.13.34.2.05.08.05.42-.11.77z"
          />
        </svg>
      </a>
      <button
        type="button"
        :title="t.copy"
        :aria-label="t.copy"
        class="flex h-10 items-center gap-2 rounded-lg border border-fill px-3 text-sm text-subtle transition hover:border-primary hover:text-primary"
        @click="copyLink"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
        <span>{{ toast || t.copy }}</span>
      </button>
      <span v-if="toast" role="status" aria-live="polite" class="sr-only">{{
        toast
      }}</span>
    </div>
  </div>
</template>
