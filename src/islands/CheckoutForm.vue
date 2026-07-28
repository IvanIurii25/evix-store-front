<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  quote,
  quoteResult,
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
    // Whether the card (maib) option may be offered. Comes from GET /site/config
    // (SSR). When false the selector is hidden and only COD is available.
    cardPaymentEnabled?: boolean;
  }>(),
  { isLoggedIn: false, savedAddresses: () => [], cardPaymentEnabled: false },
);
const t = checkoutStrings(props.lang);

const email = ref('');
const phone = ref('');
const deliveryType = ref<'pickup' | 'courier'>('pickup');
// Payment method: COD is always the default; 'card' is selectable only when the
// gateway is enabled server-side (props.cardPaymentEnabled).
const paymentMethod = ref<'cod' | 'card'>('cod');
const consent = ref(false);
const q = ref<QuoteOut | null>(null);
const quoteError = ref('');
const error = ref('');
const loading = ref(false);

// Promo code: `promoInput` is the field, `appliedCode` is the code currently
// held in the quote state (re-sent on every re-quote). `promoError` shows a
// localized message under the field; `promoBusy` guards the Apply button.
const promoInput = ref('');
const appliedCode = ref('');
const promoError = ref('');
const promoBusy = ref(false);

// Discount amount from the current quote ("0" when none), for the summary line.
const discount = computed(() => (q.value ? Number(q.value.discount_total) : 0));

// Map a backend promo error code to a localized message.
function promoMessage(code: string | null): string {
  switch (code) {
    case 'promo_invalid':
      return t.promoErrInvalid;
    case 'promo_expired':
      return t.promoErrExpired;
    case 'promo_min_order':
      return t.promoErrMinOrder;
    case 'promo_usage_limit':
      return t.promoErrUsageLimit;
    default:
      return t.promoErrGeneric;
  }
}

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
  q.value = appliedCode.value
    ? await quote(
        deliveryType.value,
        deliveryAddress.value,
        props.lang,
        deliveryAddressId.value,
        appliedCode.value,
      )
    : await quote(
        deliveryType.value,
        deliveryAddress.value,
        props.lang,
        deliveryAddressId.value,
      );
  // A held code that became unusable on re-quote (delivery/address change) must
  // not break the base quote: drop it and re-quote without it.
  if (!q.value && appliedCode.value) {
    promoError.value = t.promoErrGeneric;
    appliedCode.value = '';
    q.value = await quote(
      deliveryType.value,
      deliveryAddress.value,
      props.lang,
      deliveryAddressId.value,
    );
  }
  if (!q.value && deliveryType.value === 'courier') {
    quoteError.value = t.errAddress;
  }
}

// Apply the code in the field: try a quote with it; keep it on success,
// otherwise show the mapped error and leave nothing applied.
async function applyPromo() {
  const code = promoInput.value.trim();
  if (!code || promoBusy.value) return;
  promoBusy.value = true;
  promoError.value = '';
  const res = await quoteResult(
    deliveryType.value,
    deliveryAddress.value,
    props.lang,
    deliveryAddressId.value,
    code,
  );
  if (res.data && Number(res.data.discount_total) > 0) {
    appliedCode.value = code;
    q.value = res.data;
  } else if (res.data) {
    // Quote succeeded but the code produced no discount — treat as invalid.
    promoError.value = t.promoErrInvalid;
  } else {
    promoError.value = promoMessage(res.error);
  }
  promoBusy.value = false;
}

// Remove the applied code and re-quote without it.
async function removePromo() {
  appliedCode.value = '';
  promoInput.value = '';
  promoError.value = '';
  await refreshQuote();
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
  // Card is only ever submitted when the gateway is enabled; guard so a stale
  // selection can never send 'card' to a disabled backend (would 400).
  const method: 'cod' | 'card' =
    paymentMethod.value === 'card' && props.cardPaymentEnabled ? 'card' : 'cod';
  loading.value = true;
  try {
    const order = await checkout(
      {
        email: email.value,
        phone: phone.value,
        delivery_type: deliveryType.value,
        delivery_address: deliveryAddress.value,
        delivery_address_id: deliveryAddressId.value,
        // Only include the code when one is applied, so promo-free orders keep
        // their prior request body.
        ...(appliedCode.value ? { promo_code: appliedCode.value } : {}),
        // COD keeps the prior body shape; card is sent explicitly.
        ...(method === 'card' ? { payment_method: 'card' } : {}),
      },
      props.lang,
    );
    // Card flow: the backend created a pending order and returned a maib pay_url
    // — redirect the browser there to complete payment. If it's missing, the
    // gateway link failed: surface an error instead of a broken redirect.
    if (method === 'card') {
      if (order.pay_url) {
        location.href = order.pay_url;
        return;
      }
      error.value = t.errPayRedirect;
      return;
    }
    // Pass the contact email to the success page via a short-lived cookie, not
    // the URL, so it isn't left in browser history / logs (LP195/2024 — no PII
    // in URLs). The success page reads it server-side to fetch the order.
    document.cookie = `order_email=${encodeURIComponent(email.value)}; Max-Age=600; Path=/; SameSite=Lax`;
    location.href = localePath(
      props.lang,
      `checkout/success?number=${encodeURIComponent(order.number)}`,
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
            type="email"
            required
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
        <div v-if="cardPaymentEnabled" class="mt-3 space-y-2">
          <label class="flex items-center gap-2">
            <input
              v-model="paymentMethod"
              type="radio"
              value="cod"
              class="accent-primary"
            />
            {{ t.payMethodCod }}
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="paymentMethod"
              type="radio"
              value="card"
              class="accent-primary"
            />
            {{ t.payMethodCard }}
          </label>
          <p v-if="paymentMethod === 'card'" class="text-sm text-subtle">
            {{ t.payCardInfo }}
          </p>
          <p v-else class="text-sm text-body">{{ t.paymentInfo }}</p>
        </div>
        <p v-else class="mt-2 text-sm text-body">
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
          <div v-if="discount > 0" class="flex justify-between text-price">
            <dt>
              {{ t.discount }}
              <span v-if="appliedCode" class="font-mono text-xs uppercase">{{
                appliedCode
              }}</span>
            </dt>
            <dd>−{{ price(discount) }}</dd>
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

        <div class="mt-4 border-t border-fill pt-4">
          <label class="text-sm font-medium text-ink">{{ t.promoCode }}</label>
          <div
            v-if="appliedCode && discount > 0"
            class="mt-2 flex items-center justify-between gap-2 rounded-lg bg-fill px-3 py-2 text-sm"
          >
            <span>
              <span class="text-price">{{ t.promoApplied }}:</span>
              <span class="ml-1 font-mono uppercase text-ink">{{
                appliedCode
              }}</span>
            </span>
            <button
              type="button"
              class="font-medium text-danger hover:underline"
              @click="removePromo"
            >
              {{ t.promoRemove }}
            </button>
          </div>
          <div v-else class="mt-2 flex gap-2">
            <input
              v-model="promoInput"
              :placeholder="t.promoPlaceholder"
              class="min-w-0 flex-1 rounded-lg bg-fill px-3 py-2 uppercase outline-none"
              @keydown.enter.prevent="applyPromo"
            />
            <button
              type="button"
              :disabled="promoBusy || !promoInput.trim()"
              class="rounded-lg border-2 border-fill px-4 py-2 text-sm font-medium text-body transition hover:border-primary hover:text-primary disabled:opacity-50"
              @click="applyPromo"
            >
              {{ t.promoApply }}
            </button>
          </div>
          <p v-if="promoError" class="mt-2 text-sm text-danger">
            {{ promoError }}
          </p>
        </div>

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
