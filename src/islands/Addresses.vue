<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  listAddresses,
  createAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressOut,
} from '../api/account';
import { type Lang } from '../lib/i18n';
import { accountStrings } from '../lib/i18n-strings';

const props = defineProps<{ lang: Lang }>();
const t = accountStrings(props.lang);

const addresses = ref<AddressOut[]>([]);
const loading = ref(true);
const showForm = ref(false);
const busy = ref(false);
const blank = () => ({
  full_name: '',
  phone: '',
  city: '',
  street: '',
  zip: '',
  is_default: false,
});
const form = ref(blank());

async function load() {
  addresses.value = await listAddresses();
  loading.value = false;
}
onMounted(load);

async function add() {
  if (!form.value.full_name || !form.value.city || !form.value.street) return;
  busy.value = true;
  try {
    await createAddress({ ...form.value, zip: form.value.zip || null });
    form.value = blank();
    showForm.value = false;
    await load();
  } finally {
    busy.value = false;
  }
}

async function remove(id: number) {
  busy.value = true;
  try {
    await deleteAddress(id);
    await load();
  } finally {
    busy.value = false;
  }
}

async function makeDefault(id: number) {
  busy.value = true;
  try {
    await setDefaultAddress(id);
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-subtle">{{ t.loading }}</div>

    <template v-else>
      <ul v-if="addresses.length" class="space-y-3">
        <li
          v-for="a in addresses"
          :key="a.id"
          class="flex items-start justify-between gap-4 rounded-2xl border-2 border-fill p-4"
        >
          <div class="text-sm">
            <div class="font-medium text-ink">
              {{ a.full_name }}
              <span
                v-if="a.is_default"
                class="ml-2 rounded-full bg-badge-sale-bg px-2 py-0.5 text-xs text-badge-sale"
                >{{ t.addrDefault }}</span
              >
            </div>
            <div class="text-subtle">
              {{ a.city }}, {{ a.street }}{{ a.zip ? ', ' + a.zip : '' }}
            </div>
            <div class="text-subtle">{{ a.phone }}</div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1 text-sm">
            <button
              v-if="!a.is_default"
              type="button"
              class="text-primary hover:underline"
              :disabled="busy"
              @click="makeDefault(a.id)"
            >
              {{ t.addrMakeDefault }}
            </button>
            <button
              type="button"
              class="text-subtle hover:text-danger"
              :disabled="busy"
              @click="remove(a.id)"
            >
              {{ t.addrRemove }}
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="text-subtle">{{ t.addrNone }}</p>

      <form v-if="showForm" class="mt-4 space-y-2" @submit.prevent="add">
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="form.full_name"
            :placeholder="t.addrRecipient"
            class="rounded-lg bg-fill px-3 py-2 text-sm outline-none"
          />
          <input
            v-model="form.phone"
            :placeholder="t.phone"
            class="rounded-lg bg-fill px-3 py-2 text-sm outline-none"
          />
          <input
            v-model="form.city"
            :placeholder="t.addrCity"
            class="rounded-lg bg-fill px-3 py-2 text-sm outline-none"
          />
          <input
            v-model="form.street"
            :placeholder="t.addrStreet"
            class="rounded-lg bg-fill px-3 py-2 text-sm outline-none"
          />
          <input
            v-model="form.zip"
            :placeholder="t.addrZip"
            class="rounded-lg bg-fill px-3 py-2 text-sm outline-none"
          />
        </div>
        <label class="flex items-center gap-2 text-sm text-body">
          <input
            v-model="form.is_default"
            type="checkbox"
            class="accent-primary"
          />
          {{ t.addrMakeDefault }}
        </label>
        <button
          type="submit"
          :disabled="busy"
          class="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {{ t.addrSave }}
        </button>
      </form>
      <button
        v-else
        type="button"
        class="mt-4 rounded-xl border-2 border-fill px-5 py-2 text-sm font-medium text-body hover:border-primary hover:text-primary"
        @click="showForm = true"
      >
        {{ t.addrAdd }}
      </button>
    </template>
  </div>
</template>
