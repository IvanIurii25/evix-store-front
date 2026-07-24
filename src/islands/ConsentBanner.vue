<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { API_BASE } from '../config/env';
import {
  CONSENT_COOKIE,
  ANON_COOKIE,
  CONSENT_MAX_AGE,
  parseConsent,
  serializeConsent,
  CONSENT_POLICY_VERSION,
} from '../lib/consent';
import { localePath, type Lang } from '../lib/i18n';
import { consentStrings } from '../lib/i18n-strings';

const props = defineProps<{ lang: Lang }>();
const t = consentStrings(props.lang);

const visible = ref(false);
// 'banner' for a first decision, 'settings' when reopened from the footer link.
const source = ref<'banner' | 'settings'>('banner');

function readCookie(name: string): string | undefined {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax`;
}

function anonymousId(): string {
  let id = readCookie(ANON_COOKIE);
  if (!id) {
    id = crypto.randomUUID();
    writeCookie(ANON_COOKIE, id);
  }
  return id;
}

function open() {
  source.value = 'settings';
  visible.value = true;
}

onMounted(() => {
  // Show only when there is no current-version decision yet.
  const stored = parseConsent(readCookie(CONSENT_COOKIE));
  if (!stored || stored.version !== CONSENT_POLICY_VERSION) {
    source.value = 'banner';
    visible.value = true;
  }
  window.addEventListener('evix:open-consent', open);
});
onUnmounted(() => window.removeEventListener('evix:open-consent', open));

async function decide(analytics: boolean, action: 'accept_all' | 'reject_all') {
  // Persist the decision client-side first so the next SSR navigation gates
  // analytics correctly even if the proof POST is slow/blocked.
  writeCookie(CONSENT_COOKIE, serializeConsent(analytics));
  visible.value = false;

  // Fire-and-forget proof of consent (Art.7); never block the UI on it.
  void fetch(`${API_BASE}/api/v1/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      analytics,
      action,
      source: source.value,
      lang: props.lang,
      anonymous_id: anonymousId(),
    }),
  }).catch(() => {
    // Consent proof must never break the storefront.
  });
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-x-0 bottom-0 z-50 border-t border-fill bg-white/95 p-4 shadow-lg backdrop-blur"
    role="dialog"
    aria-live="polite"
  >
    <div
      class="mx-auto flex max-w-[1360px] flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <p class="text-sm text-body">
        {{ t.message }}
        <a
          :href="localePath(props.lang, 'info/privacy')"
          class="whitespace-nowrap font-medium text-primary hover:underline"
          >{{ t.moreLink }}</a
        >
      </p>
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          class="rounded-xl border-2 border-fill px-4 py-2 text-sm font-medium text-body transition hover:border-primary hover:text-primary"
          @click="decide(false, 'reject_all')"
        >
          {{ t.onlyNecessary }}
        </button>
        <button
          type="button"
          class="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          @click="decide(true, 'accept_all')"
        >
          {{ t.acceptAll }}
        </button>
      </div>
    </div>
  </div>
</template>
