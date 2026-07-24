<script setup lang="ts">
import { ref } from 'vue';
import { deleteAccount } from '../api/account';
import { localePath, type Lang } from '../lib/i18n';
import { accountStrings } from '../lib/i18n-strings';

const props = defineProps<{ lang: Lang }>();
const t = accountStrings(props.lang);

const confirming = ref(false);
const busy = ref(false);

async function confirmDelete() {
  busy.value = true;
  const ok = await deleteAccount();
  if (ok) {
    // Account erased + cookies cleared server-side → back to the storefront.
    location.href = localePath(props.lang);
    return;
  }
  busy.value = false;
  confirming.value = false;
}
</script>

<template>
  <div class="rounded-2xl border-2 border-danger/40 p-6">
    <button
      v-if="!confirming"
      type="button"
      class="text-sm font-medium text-danger hover:underline"
      @click="confirming = true"
    >
      {{ t.deleteAccount }}
    </button>

    <div v-else>
      <p class="text-sm text-body">{{ t.deleteWarning }}</p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          :disabled="busy"
          class="rounded-xl border-2 border-fill px-4 py-2 text-sm font-medium text-body transition hover:border-primary hover:text-primary disabled:opacity-50"
          @click="confirming = false"
        >
          {{ t.deleteCancel }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          @click="confirmDelete"
        >
          {{ busy ? '…' : t.deleteConfirm }}
        </button>
      </div>
    </div>
  </div>
</template>
