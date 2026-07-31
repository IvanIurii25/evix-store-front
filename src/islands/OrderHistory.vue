<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { listOrders, type OrderOut } from '../api/account';
import { price } from '../lib/format';
import { type Lang } from '../lib/i18n';
import { accountStrings, footerLabels } from '../lib/i18n-strings';
import { supportDeepLink } from '../lib/support';

const props = defineProps<{ lang: Lang }>();
const t = accountStrings(props.lang);
const supportLabel = footerLabels(props.lang).support;

// Deep-link to the support bot with this order as context (`o<number>`).
function orderSupportUrl(number: string): string | null {
  return supportDeepLink(`o${number}`);
}

const orders = ref<OrderOut[]>([]);
const loading = ref(true);

const STATUS: Record<string, string> = {
  new: t.statusNew,
  confirmed: t.statusConfirmed,
  done: t.statusDone,
  canceled: t.statusCanceled,
};

/** One-line destination for a carrier order: pickup point, or street address. */
function carrierDestination(np: NonNullable<OrderOut['novapost']>): string {
  if (np.division_number) {
    return [`№ ${np.division_number}`, np.division_address, np.settlement_name]
      .filter(Boolean)
      .join(', ');
  }
  const parts = (np.address_parts ?? {}) as Record<string, string>;
  return [parts.street, parts.building, parts.city].filter(Boolean).join(', ');
}

function fmtDate(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('ro-MD');
}

onMounted(async () => {
  orders.value = await listOrders();
  loading.value = false;
});
</script>

<template>
  <div>
    <div v-if="loading" class="text-subtle">{{ t.loading }}</div>
    <p v-else-if="!orders.length" class="text-subtle">{{ t.ordNone }}</p>
    <ul v-else class="space-y-3">
      <li
        v-for="o in orders"
        :key="o.number"
        class="flex items-center justify-between gap-4 rounded-2xl border-2 border-fill p-4"
      >
        <div class="text-sm">
          <div class="font-medium text-ink">
            {{ t.ordOrder }} {{ o.number }}
          </div>
          <div class="text-subtle">
            {{ fmtDate(o.created_at) }} · {{ STATUS[o.status] ?? o.status }}
          </div>
          <!-- Carrier orders: where the parcel is going, and its waybill once
               the shipment exists. Own-logistics orders keep the old row. -->
          <div v-if="o.novapost" class="text-xs text-subtle">
            {{ carrierDestination(o.novapost) }}
            <span v-if="o.novapost.awb_number" class="font-medium">
              · {{ o.novapost.awb_number }}
            </span>
            <span v-if="o.novapost.status_text">
              · {{ o.novapost.status_text }}
            </span>
          </div>
          <a
            v-if="orderSupportUrl(o.number)"
            :href="orderSupportUrl(o.number)!"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-block text-[11px] text-subtle underline hover:text-primary"
          >
            {{ supportLabel }}
          </a>
        </div>
        <div class="text-right">
          <div class="font-semibold text-price">{{ price(o.total) }}</div>
          <div class="text-xs text-subtle">
            {{ o.payment_status === 'paid' ? t.paid : t.awaitingPayment }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
