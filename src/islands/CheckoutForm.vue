<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  quote,
  checkout,
  type QuoteOut,
  type DeliveryAddressIn,
} from '../api/checkout';
import { price } from '../lib/format';
import { localePath, type Lang } from '../lib/i18n';

const props = defineProps<{ lang: Lang }>();

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

const courierAddressComplete = computed(
  () =>
    addrName.value.trim().length > 0 &&
    addrCity.value.trim().length > 0 &&
    addrStreet.value.trim().length > 0,
);

const deliveryAddress = computed<DeliveryAddressIn | null>(() => {
  if (deliveryType.value !== 'courier' || !courierAddressComplete.value) {
    return null;
  }
  return {
    full_name: addrName.value.trim(),
    city: addrCity.value.trim(),
    street: addrStreet.value.trim(),
    zip: addrZip.value.trim() || null,
  };
});

async function refreshQuote() {
  quoteError.value = '';
  q.value = await quote(deliveryType.value, deliveryAddress.value);
  if (!q.value && deliveryType.value === 'courier') {
    quoteError.value = 'Укажите адрес доставки (имя, город, улица).';
  }
}

onMounted(refreshQuote);
// Re-quote when the method changes or the courier address becomes (in)complete.
watch([deliveryType, courierAddressComplete], refreshQuote);

function canSubmit() {
  return (
    q.value !== null &&
    email.value.includes('@') &&
    phone.value.trim().length >= 5 &&
    consent.value &&
    (deliveryType.value === 'pickup' || courierAddressComplete.value)
  );
}

async function submit() {
  error.value = '';
  if (!email.value.includes('@')) {
    error.value = 'Введите корректный email';
    return;
  }
  if (phone.value.trim().length < 5) {
    error.value = 'Введите телефон';
    return;
  }
  if (!consent.value) {
    error.value = 'Подтвердите согласие с условиями';
    return;
  }
  if (!q.value) {
    error.value = quoteError.value || 'Расчёт недоступен';
    return;
  }
  loading.value = true;
  try {
    const order = await checkout({
      email: email.value,
      phone: phone.value,
      delivery_type: deliveryType.value,
      delivery_address: deliveryAddress.value,
    });
    location.href = localePath(
      props.lang,
      `checkout/success?number=${encodeURIComponent(order.number)}&email=${encodeURIComponent(email.value)}`,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-8 lg:flex-row">
    <form class="flex-1 space-y-6" @submit.prevent="submit">
      <section>
        <h2 class="font-semibold text-ink">Контакты</h2>
        <div class="mt-3 space-y-3">
          <input
            v-model="email"
            placeholder="Email"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="phone"
            placeholder="Телефон"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold text-ink">Доставка</h2>
        <div class="mt-3 space-y-2">
          <label class="flex items-center gap-2">
            <input
              v-model="deliveryType"
              type="radio"
              value="pickup"
              class="accent-primary"
            />
            Самовывоз (бесплатно)
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="deliveryType"
              type="radio"
              value="courier"
              class="accent-primary"
            />
            Курьер
          </label>
        </div>

        <div v-if="deliveryType === 'courier'" class="mt-3 space-y-3">
          <input
            v-model="addrName"
            placeholder="Имя получателя"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="addrCity"
            placeholder="Город"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="addrStreet"
            placeholder="Улица, дом, квартира"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
          <input
            v-model="addrZip"
            placeholder="Индекс (необязательно)"
            class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
          />
        </div>

        <p v-if="quoteError" class="mt-2 text-sm text-danger">
          {{ quoteError }}
        </p>
      </section>

      <section>
        <h2 class="font-semibold text-ink">Оплата</h2>
        <p class="mt-2 text-sm text-body">
          Оплата при получении (наличными или картой курьеру / в пункте выдачи).
        </p>
      </section>

      <label class="flex items-start gap-2 text-sm text-body">
        <input
          v-model="consent"
          type="checkbox"
          class="mt-0.5 accent-primary"
        />
        Согласен с условиями оформления заказа
      </label>
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </form>

    <aside class="lg:w-80">
      <div class="rounded-2xl border-2 border-fill p-6">
        <h2 class="font-semibold text-ink">Ваш заказ</h2>
        <dl v-if="q" class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-subtle">Товары ({{ q.item_count }})</dt>
            <dd>{{ price(q.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-subtle">Доставка</dt>
            <dd>
              {{
                Number(q.delivery_cost) > 0
                  ? price(q.delivery_cost)
                  : 'бесплатно'
              }}
            </dd>
          </div>
          <div
            class="flex items-baseline justify-between border-t border-fill pt-2"
          >
            <dt class="font-semibold text-ink">Итого</dt>
            <dd class="text-xl font-semibold text-price">
              {{ price(q.total) }}
            </dd>
          </div>
        </dl>
        <p v-else class="mt-4 text-sm text-subtle">Расчёт недоступен.</p>

        <button
          type="button"
          :disabled="loading || !canSubmit()"
          class="mt-5 w-full rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
          @click="submit"
        >
          {{ loading ? '…' : 'Оформить заказ' }}
        </button>
      </div>
    </aside>
  </div>
</template>
