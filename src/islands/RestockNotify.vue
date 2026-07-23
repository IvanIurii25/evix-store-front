<script setup lang="ts">
import { onMounted, ref } from 'vue';

import {
  getRestockStatus,
  subscribeRestock,
  unsubscribeRestock,
} from '../api/restock';
import { localePath, type Lang } from '../lib/i18n';

const props = defineProps<{
  productId: number;
  lang: Lang;
  // The product's own path (e.g. /ru/p/slug) — carried through login as `next`.
  productPath: string;
}>();

type State = 'loading' | 'guest' | 'idle' | 'subscribed' | 'busy';
const state = ref<State>('loading');

const t = {
  ru: { notify: 'Уведомить о поступлении', done: 'Вы подписаны ✓', off: 'Отписаться' },
  ro: { notify: 'Anunță-mă când apare', done: 'Ești abonat ✓', off: 'Dezabonează-te' },
}[props.lang];

// Send a guest to login, carrying the product + intent so we auto-subscribe back.
function toLogin() {
  const next = `${props.productPath}?notify=1`;
  location.href = `${localePath(props.lang, 'auth')}?next=${encodeURIComponent(next)}`;
}

async function doSubscribe() {
  state.value = 'busy';
  const res = await subscribeRestock(props.productId, props.lang);
  if (res === 'guest') return toLogin();
  state.value = res === 'ok' ? 'subscribed' : 'idle';
}

async function doUnsubscribe() {
  state.value = 'busy';
  await unsubscribeRestock(props.productId);
  state.value = 'idle';
}

function onClick() {
  if (state.value === 'guest') return toLogin();
  if (state.value === 'idle') return doSubscribe();
  if (state.value === 'subscribed') return doUnsubscribe();
}

onMounted(async () => {
  const status = await getRestockStatus(props.productId);
  const wantsNotify = new URLSearchParams(location.search).get('notify') === '1';
  if (wantsNotify) {
    // Clean the intent flag from the URL regardless of outcome.
    const url = new URL(location.href);
    url.searchParams.delete('notify');
    history.replaceState({}, '', url);
  }
  if (!status.authed) {
    // Post-login return with intent but somehow unauthed → let them retry.
    state.value = 'guest';
    return;
  }
  if (status.subscribed) {
    state.value = 'subscribed';
    return;
  }
  if (wantsNotify) {
    await doSubscribe(); // auto-subscribe after login redirect
    return;
  }
  state.value = 'idle';
});
</script>

<template>
  <div>
    <button
      type="button"
      :disabled="state === 'loading' || state === 'busy'"
      class="h-12 w-full rounded-xl border-2 border-primary font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
      :class="state === 'subscribed' ? 'group' : ''"
      @click="onClick"
    >
      <template v-if="state === 'loading' || state === 'busy'">…</template>
      <template v-else-if="state === 'subscribed'">
        <span class="group-hover:hidden">{{ t.done }}</span>
        <span class="hidden group-hover:inline">{{ t.off }}</span>
      </template>
      <template v-else>{{ t.notify }}</template>
    </button>
    <p class="mt-2 text-xs text-subtle">
      {{
        lang === 'ru'
          ? 'Пришлём письмо, когда товар появится.'
          : 'Îți trimitem un e-mail când produsul revine.'
      }}
    </p>
  </div>
</template>
