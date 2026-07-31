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
import type { CarrierSelection } from '../api/checkout';
import {
  listDeliveryMethods,
  listDivisions,
  searchSettlements,
  type AddressField,
  type DeliveryMethod,
  type Division,
  type Settlement,
} from '../api/delivery';
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
// A method is the (service, type) pair the API expects. The radio group binds
// one composite key so the two halves can never drift out of step.
type MethodKey =
  | 'own:pickup'
  | 'own:courier'
  | 'novapost:branch'
  | 'novapost:postomat'
  | 'novapost:courier';

const methodKey = ref<MethodKey>('own:pickup');
const deliveryService = computed(
  () => methodKey.value.split(':')[0] as 'own' | 'novapost',
);
const deliveryType = computed(() => methodKey.value.split(':')[1]);
const isCarrier = computed(() => deliveryService.value === 'novapost');
const carrierPoint = computed(
  () => isCarrier.value && deliveryType.value !== 'courier',
);

// Which carrier methods the server says we may offer (empty = carrier off).
const carrierMethods = ref<DeliveryMethod[]>([]);
const carrierTypes = computed(
  () => new Set(carrierMethods.value.map((m) => m.type)),
);
const carrierAddressFields = computed<AddressField[]>(
  () =>
    carrierMethods.value.find((m) => m.type === 'courier')?.address_fields ??
    [],
);

// City picker (typeahead) shared by every carrier method.
const cityQuery = ref('');
const cityOptions = ref<Settlement[]>([]);
const city = ref<Settlement | null>(null);
const cityBusy = ref(false);
let cityTimer: ReturnType<typeof setTimeout> | undefined;

// Pickup-point picker (branch / postomat).
const pointQuery = ref('');
const pointOptions = ref<Division[]>([]);
const point = ref<Division | null>(null);
const pointBusy = ref(false);
let pointTimer: ReturnType<typeof setTimeout> | undefined;

// Carrier courier address, keyed by the server-declared field names.
const npAddress = ref<Record<string, string>>({});
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

// A carrier method is quotable once its destination is known: a pickup point,
// or a city plus every field the server marked required.
const carrierReady = computed(() => {
  if (!isCarrier.value) return true;
  if (carrierPoint.value) return point.value !== null;
  if (!city.value) return false;
  return carrierAddressFields.value
    .filter((f) => f.required)
    .every((f) => (npAddress.value[f.name] ?? '').trim().length > 0);
});

// The carrier half of the request body; omitted entirely for own logistics so
// those requests keep the exact shape they had before Nova Post existed.
const carrierSelection = computed<CarrierSelection | null>(() => {
  if (!isCarrier.value) return null;
  if (carrierPoint.value) {
    return {
      delivery_service: 'novapost',
      np_settlement_id: city.value?.id ?? null,
      np_division_id: point.value?.id ?? null,
    };
  }
  const filled: Record<string, string> = {};
  for (const field of carrierAddressFields.value) {
    const value = (npAddress.value[field.name] ?? '').trim();
    if (value) filled[field.name] = value;
  }
  return {
    delivery_service: 'novapost',
    np_settlement_id: city.value?.id ?? null,
    np_address: filled as unknown as CarrierSelection['np_address'],
  };
});

// Debounced city lookup. Typing is what makes this expensive, so the request is
// held back until the customer pauses.
watch(cityQuery, (term) => {
  clearTimeout(cityTimer);
  if (!isCarrier.value || term.trim().length < 2) {
    cityOptions.value = [];
    return;
  }
  cityBusy.value = true;
  cityTimer = setTimeout(async () => {
    cityOptions.value = await searchSettlements(term.trim(), props.lang);
    cityBusy.value = false;
  }, 300);
});

// Pickup points reload when the city, the method or the filter changes.
watch([city, methodKey, pointQuery], () => {
  clearTimeout(pointTimer);
  if (!carrierPoint.value || !city.value) {
    pointOptions.value = [];
    return;
  }
  pointBusy.value = true;
  pointTimer = setTimeout(async () => {
    pointOptions.value = await listDivisions(
      city.value!.id,
      deliveryType.value as 'branch' | 'postomat',
      pointQuery.value.trim(),
      props.lang,
    );
    pointBusy.value = false;
  }, 300);
});

function pickCity(option: Settlement) {
  city.value = option;
  cityQuery.value = option.name;
  cityOptions.value = [];
  // The previously chosen point belongs to the old city.
  point.value = null;
}

// Own-logistics quotes keep the exact call (and request body) they had before
// the carrier existed: the extra arguments are only appended when they carry
// something. Fewer moving parts on the path that handles most orders.
async function runQuote(code: string | null) {
  const carrier = carrierSelection.value;
  if (carrier) {
    return quote(
      deliveryType.value,
      deliveryAddress.value,
      props.lang,
      deliveryAddressId.value,
      code,
      carrier,
    );
  }
  if (code) {
    return quote(
      deliveryType.value,
      deliveryAddress.value,
      props.lang,
      deliveryAddressId.value,
      code,
    );
  }
  return quote(
    deliveryType.value,
    deliveryAddress.value,
    props.lang,
    deliveryAddressId.value,
  );
}

async function refreshQuote() {
  quoteError.value = '';
  if (isCarrier.value && !carrierReady.value) {
    // Nothing to price yet: keep the previous total and wait for a destination
    // instead of firing a request the server will reject.
    q.value = null;
    quoteError.value = '';
    return;
  }
  q.value = await runQuote(appliedCode.value || null);
  // A held code that became unusable on re-quote (delivery/address change) must
  // not break the base quote: drop it and re-quote without it.
  if (!q.value && appliedCode.value) {
    promoError.value = t.promoErrGeneric;
    appliedCode.value = '';
    q.value = await runQuote(null);
  }
  if (!q.value) {
    if (isCarrier.value) {
      // The destination is filled in, so a missing quote means the carrier
      // itself could not answer (502) — say so rather than blaming the address.
      quoteError.value = t.npErrLookup;
    } else if (deliveryType.value === 'courier') {
      quoteError.value = t.errAddress;
    }
  }
}

// Apply the code in the field: try a quote with it; keep it on success,
// otherwise show the mapped error and leave nothing applied.
async function applyPromo() {
  const code = promoInput.value.trim();
  if (!code || promoBusy.value) return;
  promoBusy.value = true;
  promoError.value = '';
  const res = carrierSelection.value
    ? await quoteResult(
        deliveryType.value,
        deliveryAddress.value,
        props.lang,
        deliveryAddressId.value,
        code,
        carrierSelection.value,
      )
    : await quoteResult(
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

onMounted(async () => {
  // The offer list is server-driven: the carrier may be off, or only some of
  // its categories enabled.
  const methods = await listDeliveryMethods();
  carrierMethods.value = methods.methods.filter(
    (m) => m.service === 'novapost',
  );
  await refreshQuote();
});
// Re-quote when the method, the picked address, the inline address or the
// carrier destination changes.
watch(
  [
    methodKey,
    courierAddressReady,
    deliveryAddressId,
    carrierReady,
    point,
    city,
  ],
  refreshQuote,
);

function canSubmit() {
  return (
    q.value !== null &&
    email.value.includes('@') &&
    phone.value.trim().length >= 5 &&
    consent.value &&
    (isCarrier.value
      ? carrierReady.value
      : deliveryType.value === 'pickup' || courierAddressReady.value)
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
        ...(carrierSelection.value ?? {}),
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
              v-model="methodKey"
              type="radio"
              value="own:pickup"
              class="accent-primary"
            />
            {{ t.pickup }}
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="methodKey"
              type="radio"
              value="own:courier"
              class="accent-primary"
            />
            {{ t.courier }}
          </label>
          <label
            v-if="carrierTypes.has('branch')"
            class="flex items-center gap-2"
          >
            <input
              v-model="methodKey"
              type="radio"
              value="novapost:branch"
              class="accent-primary"
            />
            {{ t.npBranch }}
          </label>
          <label
            v-if="carrierTypes.has('postomat')"
            class="flex items-center gap-2"
          >
            <input
              v-model="methodKey"
              type="radio"
              value="novapost:postomat"
              class="accent-primary"
            />
            {{ t.npPostomat }}
          </label>
          <label
            v-if="carrierTypes.has('courier')"
            class="flex items-center gap-2"
          >
            <input
              v-model="methodKey"
              type="radio"
              value="novapost:courier"
              class="accent-primary"
            />
            {{ t.npCourier }}
          </label>
        </div>

        <!-- Carrier destination: city first, then a pickup point or an address -->
        <div v-if="isCarrier" class="mt-4 space-y-3">
          <div class="relative">
            <label class="block text-sm font-medium text-ink">{{
              t.npCity
            }}</label>
            <input
              v-model="cityQuery"
              type="text"
              :placeholder="t.npCityPlaceholder"
              class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
              @input="city = null"
            />
            <p v-if="cityBusy" class="mt-1 text-xs text-subtle">
              {{ t.npSearching }}
            </p>
            <ul
              v-if="cityOptions.length"
              class="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border-2 border-fill bg-white shadow-lg"
            >
              <li v-for="option in cityOptions" :key="option.id">
                <button
                  type="button"
                  class="w-full px-3 py-2 text-left text-sm hover:bg-fill"
                  @click="pickCity(option)"
                >
                  {{ option.name }}
                </button>
              </li>
            </ul>
            <p
              v-else-if="!cityBusy && cityQuery.trim().length >= 2 && !city"
              class="mt-1 text-xs text-subtle"
            >
              {{ t.npCityEmpty }}
            </p>
          </div>

          <div v-if="carrierPoint">
            <label class="block text-sm font-medium text-ink">{{
              t.npPoint
            }}</label>
            <p v-if="!city" class="mt-1 text-xs text-subtle">
              {{ t.npPickCityFirst }}
            </p>
            <template v-else>
              <input
                v-model="pointQuery"
                type="text"
                :placeholder="t.npPointPlaceholder"
                class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
              />
              <p v-if="pointBusy" class="mt-1 text-xs text-subtle">
                {{ t.npSearching }}
              </p>
              <ul v-else-if="pointOptions.length" class="mt-2 space-y-2">
                <li v-for="option in pointOptions" :key="option.id">
                  <label
                    class="flex items-start gap-2 rounded-lg bg-fill px-3 py-2"
                  >
                    <input
                      v-model="point"
                      type="radio"
                      :value="option"
                      class="mt-1 accent-primary"
                    />
                    <span class="text-sm">
                      <span class="font-medium text-ink"
                        >№ {{ option.number }}</span
                      >
                      <span class="block text-subtle">{{
                        option.address
                      }}</span>
                    </span>
                  </label>
                </li>
              </ul>
              <p v-else class="mt-1 text-xs text-subtle">
                {{ t.npPointEmpty }}
              </p>
            </template>
          </div>

          <!-- Address form built from the server's field contract -->
          <div v-else class="space-y-2">
            <div v-for="field in carrierAddressFields" :key="field.name">
              <input
                v-model="npAddress[field.name]"
                type="text"
                :maxlength="field.max_length"
                :placeholder="
                  (lang === 'ru' ? field.label_ru : field.label_ro) +
                  (field.required ? ' *' : '')
                "
                class="w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div v-if="showPicker && !isCarrier" class="mt-3 space-y-2">
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
          v-if="!isCarrier && deliveryType === 'courier' && !usingSavedAddress"
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
