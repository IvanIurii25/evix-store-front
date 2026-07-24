<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  quote,
  checkout,
  type QuoteOut,
  type DeliveryAddressIn,
} from '../api/checkout';
import type { AddressOut } from '../api/account';
import { price } from '../lib/format';
import { localePath, type Lang } from '../lib/i18n';
import { checkoutStrings } from '../lib/i18n-strings';

const props = withDefaults(
  defineProps<{
    lang: Lang;
    isLoggedIn?: boolean;
    savedAddresses?: AddressOut[];
  }>(),
  { isLoggedIn: false, savedAddresses: () => [] },
);
const t = checkoutStrings(props.lang);

const email = ref('');
const phone = ref('');
const deliveryType = ref<'pickup' | 'courier'>('pickup');
const consent = ref(false);
const q = ref<QuoteOut | null>(null);
const quoteError = ref('');
const error = ref('');
const loading = ref(false);

// Inline courier address (guest + user). Snapshotted onto the order by the API.
const addrName = ref('');
const addrCity = ref('');
const addrStreet = ref('');
const addrZip = ref('');

// Saved-address picker: shown for logged-in courier orders that have addresses.
// selectedAddressId === null means "enter another address" (inline fallback).
const hasSavedAddresses = computed(
  () => props.isLoggedIn && props.savedAddresses.length > 0,
);
const selectedAddressId = ref<number | null>(
  props.savedAddresses.find((a) => a.is_default)?.id ??
    props.savedAddresses[0]?.id ??
    null,
);
const showPicker = computed(
  () => deliveryType.value === 'courier' && hasSavedAddresses.value,
);
const usingSavedAddress = computed(
  () => showPicker.value && selectedAddressId.value !== null,
);

const courierAddressComplete = computed(
  () =>
    addrName.value.trim().length > 0 &&
    addrCity.value.trim().length > 0 &&
    addrStreet.value.trim().length > 0,
);

const deliveryAddress = computed<DeliveryAddressIn | null>(() => {
  // A picked saved address is sent by id instead of an inline snapshot.
  if (
    deliveryType.value !== 'courier' ||
    usingSavedAddress.value ||
    !courierAddressComplete.value
  ) {
    return null;
  }
  return {
    full_name: addrName.value.trim(),
    city: addrCity.value.trim(),
    street: addrStreet.value.trim(),
    zip: addrZip.value.trim() || null,
  };
});

const deliveryAddressId = computed<number | null>(() =>
  usingSavedAddress.value ? selectedAddressId.value : null,
);

// Courier delivery is addressable once a saved address is picked OR the inline
// form is complete.
const courierAddressReady = computed(
  () => usingSavedAddress.value || courierAddressComplete.value,
);

async function refreshQuote() {
  quoteError.value = '';
  q.value = await quote(
    deliveryType.value,
    deliveryAddress.value,
    props.lang,
    deliveryAddressId.value,
  );
  if (!q.value && deliveryType.value === 'courier') {
    quoteError.value = t.errAddress;
  }
}

onMounted(refreshQuote);
// Re-quote when the method, the picked address, or the inline address changes.
watch([deliveryType, courierAddressReady, deliveryAddressId], refreshQuote);

function canSubmit() {
  return (
    q.value !== null &&
    email.value.includes('@') &&
    phone.value.trim().length >= 5 &&
    consent.value &&
    (deliveryType.value === 'pickup' || courierAddressReady.value)
  );
}

async function submit() {
  error.value = '';
  if (!email.value.includes('@')) {
    error.value = t.errEmail;
    return;
  }
  if (phone.value.trim().length < 5) {
    error.value = t.errPhone;
    return;
  }
  if (!consent.value) {
    error.value = t.errConsent;
    return;
  }
  if (!q.value) {
    error.value = quoteError.value || t.errCalc;
    return;
  }
  loading.value = true;
  try {
    const order = await checkout(
      {
        email: email.value,
        phone: phone.value,
        delivery_type: deliveryType.value,
        delivery_address: deliveryAddress.value,
        delivery_address_id: deliveryAddressId.value,
      },
      props.lang,
    );
    location.href = localePath(
      props.lang,
      `checkout/success?number=${encodeURIComponent(order.number)}&email=${encodeURIComponent(email.value)}`,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : t.errGeneric;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-8 lg:flex-row">
    <form class="flex-1 space-y-6" @submit.prevent="submit">
      <section>
        <h2 class="font-semibold text-ink">{{ t.contacts }}</h2>
        <div class="mt-3 space-y-3">
          <input
            v-model="email"
            placeholder="Email"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="phone"
            :placeholder="t.phone"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold text-ink">{{ t.delivery }}</h2>
        <div class="mt-3 space-y-2">
          <label class="flex items-center gap-2">
            <input
              v-model="deliveryType"
              type="radio"
              value="pickup"
              class="accent-primary"
            />
            {{ t.pickup }}
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="deliveryType"
              type="radio"
              value="courier"
              class="accent-primary"
            />
            {{ t.courier }}
          </label>
        </div>

        <div v-if="showPicker" class="mt-3 space-y-2">
          <p class="text-sm font-medium text-ink">{{ t.savedAddresses }}</p>
          <label
            v-for="a in savedAddresses"
            :key="a.id"
            class="flex items-start gap-2 rounded-lg bg-fill px-3 py-2"
          >
            <input
              v-model="selectedAddressId"
              type="radio"
              :value="a.id"
              class="mt-1 accent-primary"
            />
            <span class="text-sm">
              <span class="font-medium text-ink">{{ a.full_name }}</span>
              <span class="block text-subtle">
                {{ a.city }}, {{ a.street }}{{ a.zip ? ', ' + a.zip : '' }}
              </span>
            </span>
          </label>
          <label class="flex items-center gap-2 rounded-lg bg-fill px-3 py-2">
            <input
              v-model="selectedAddressId"
              type="radio"
              :value="null"
              class="accent-primary"
            />
            <span class="text-sm text-body">{{ t.useAnotherAddress }}</span>
          </label>
        </div>

        <div
          v-if="deliveryType === 'courier' && !usingSavedAddress"
          class="mt-3 space-y-3"
        >
          <input
            v-model="addrName"
            :placeholder="t.recipientName"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="addrCity"
            :placeholder="t.city"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="addrStreet"
            :placeholder="t.street"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="addrZip"
            :placeholder="t.zipOptional"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
        </div>

        <p v-if="quoteError" class="mt-2 text-sm text-danger">
          {{ quoteError }}
        </p>
      </section>

      <section>
        <h2 class="font-semibold text-ink">{{ t.payment }}</h2>
        <p class="mt-2 text-sm text-body">
          {{ t.paymentInfo }}
        </p>
      </section>

      <label class="flex items-start gap-2 text-sm text-body">
        <input
          v-model="consent"
          type="checkbox"
          class="mt-0.5 accent-primary"
        />
        {{ t.consent }}
      </label>
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </form>

    <aside class="lg:w-80">
      <div class="rounded-2xl border-2 border-fill p-6">
        <h2 class="font-semibold text-ink">{{ t.yourOrder }}</h2>
        <dl v-if="q" class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-subtle">{{ t.items }} ({{ q.item_count }})</dt>
            <dd>{{ price(q.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-subtle">{{ t.delivery }}</dt>
            <dd>
              {{
                Number(q.delivery_cost) > 0 ? price(q.delivery_cost) : t.free
              }}
            </dd>
          </div>
          <div
            class="flex items-baseline justify-between border-t border-fill pt-2"
          >
            <dt class="font-semibold text-ink">{{ t.total }}</dt>
            <dd class="text-xl font-semibold text-price">
              {{ price(q.total) }}
            </dd>
          </div>
        </dl>
        <p v-else class="mt-4 text-sm text-subtle">{{ t.quoteUnavailable }}</p>

        <button
          type="button"
          :disabled="loading || !canSubmit()"
          class="mt-5 w-full rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
          @click="submit"
        >
          {{ loading ? '…' : t.placeOrder }}
        </button>
      </div>
    </aside>
  </div>
</template>
