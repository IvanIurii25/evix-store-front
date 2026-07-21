<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  dashboardSummary,
  revenueSeries,
  type DashboardSummary,
  type RevenueSeries,
} from '../../api/admin';

const summary = ref<DashboardSummary | null>(null);
const series = ref<RevenueSeries | null>(null);
const loading = ref(true);
const error = ref('');

// MDL money formatting: Decimals arrive as strings from the API.
function money(value: string | number): string {
  return `${Number(value).toLocaleString('ru-RU')} L`;
}

onMounted(async () => {
  try {
    const [s, r] = await Promise.all([dashboardSummary(), revenueSeries()]);
    summary.value = s;
    series.value = r;
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Не удалось загрузить дашборд';
  } finally {
    loading.value = false;
  }
});

// --------------------------------------------------------------------------- //
// Revenue chart — hand-drawn SVG bars scaled to the max value in the series.
// --------------------------------------------------------------------------- //
const CHART_W = 600;
const CHART_H = 200;
const PAD = 8;

interface ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

const chartPoints = computed(() => series.value?.data ?? []);

const maxRevenue = computed(() =>
  chartPoints.value.reduce((max, p) => Math.max(max, Number(p.revenue)), 0),
);

const bars = computed<ChartBar[]>(() => {
  const points = chartPoints.value;
  const peak = maxRevenue.value;
  if (points.length === 0 || peak <= 0) return [];

  const usableW = CHART_W - PAD * 2;
  const usableH = CHART_H - PAD * 2;
  const slot = usableW / points.length;
  const barWidth = Math.max(1, slot * 0.7);

  return points.map((p, i) => {
    const height = (Number(p.revenue) / peak) * usableH;
    return {
      x: PAD + slot * i + (slot - barWidth) / 2,
      y: CHART_H - PAD - height,
      width: barWidth,
      height,
    };
  });
});

const firstDay = computed(() => chartPoints.value[0]?.day ?? '');
const lastDay = computed(
  () => chartPoints.value[chartPoints.value.length - 1]?.day ?? '',
);

// The list fields are optional in the API schema — normalize to arrays so the
// template can iterate and read `.length` without runtime guards.
const topProducts = computed(() => summary.value?.top_products ?? []);
const lowStock = computed(() => summary.value?.low_stock ?? []);
const statusDistribution = computed(
  () => summary.value?.status_distribution ?? [],
);
</script>

<template>
  <div>
    <p v-if="loading" class="text-subtle">Загрузка…</p>
    <p v-else-if="error" class="text-danger">{{ error }}</p>

    <div v-else-if="summary" class="space-y-6">
      <!-- KPI cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Выручка</p>
          <p class="mt-2 text-2xl font-bold text-price">
            {{ money(summary.revenue) }}
          </p>
        </div>

        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Заказов</p>
          <p class="mt-2 text-2xl font-bold text-ink">
            {{ summary.orders_count.toLocaleString('ru-RU') }}
          </p>
          <p class="mt-1 text-xs text-subtle">
            Оплачено: {{ summary.paid_orders_count.toLocaleString('ru-RU') }}
          </p>
        </div>

        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Средний чек</p>
          <p class="mt-2 text-2xl font-bold text-ink">
            {{ money(summary.avg_order_value) }}
          </p>
        </div>

        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Мало на складе</p>
          <p
            class="mt-2 text-2xl font-bold"
            :class="summary.low_stock_count > 0 ? 'text-danger' : 'text-ink'"
          >
            {{ summary.low_stock_count.toLocaleString('ru-RU') }}
          </p>
        </div>
      </div>

      <!-- Revenue chart -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <h2 class="text-sm font-semibold text-ink">Выручка по дням</h2>

        <div v-if="bars.length" class="mt-4">
          <svg
            :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
            class="w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="График выручки по дням"
          >
            <rect
              v-for="(bar, i) in bars"
              :key="i"
              :x="bar.x"
              :y="bar.y"
              :width="bar.width"
              :height="bar.height"
              rx="2"
              class="fill-primary"
            />
          </svg>
          <div class="mt-2 flex justify-between text-xs text-subtle">
            <span>{{ firstDay }}</span>
            <span>Максимум: {{ money(maxRevenue) }}</span>
            <span>{{ lastDay }}</span>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-subtle">Нет данных за период</p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Top products -->
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h2 class="text-sm font-semibold text-ink">Топ товаров</h2>
          <ul v-if="topProducts.length" class="mt-4 space-y-3">
            <li
              v-for="(p, i) in topProducts"
              :key="p.product_id ?? `top-${i}`"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <span class="min-w-0 truncate text-body">{{ p.name }}</span>
              <span class="flex shrink-0 items-center gap-3">
                <span class="text-subtle">{{ p.qty_sold }} шт.</span>
                <span class="font-medium text-price">{{
                  money(p.revenue)
                }}</span>
              </span>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-subtle">Нет продаж</p>
        </div>

        <!-- Low stock -->
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h2 class="text-sm font-semibold text-ink">
            Заканчивается на складе
          </h2>
          <ul v-if="lowStock.length" class="mt-4 space-y-3">
            <li
              v-for="item in lowStock"
              :key="item.id"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <span class="min-w-0 truncate font-medium text-body">{{
                item.code
              }}</span>
              <span
                class="shrink-0 font-medium"
                :class="item.qty > 0 ? 'text-subtle' : 'text-danger'"
                >{{ item.qty }} шт.</span
              >
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-subtle">Всё в наличии</p>
        </div>
      </div>

      <!-- Order status distribution -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <h2 class="text-sm font-semibold text-ink">Статусы заказов</h2>
        <div v-if="statusDistribution.length" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="s in statusDistribution"
            :key="s.name"
            class="inline-flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-xs font-medium text-body"
          >
            {{ s.name }}
            <span class="rounded-full bg-white px-1.5 text-ink">{{
              s.count
            }}</span>
          </span>
        </div>
        <p v-else class="mt-4 text-sm text-subtle">Нет заказов</p>
      </div>
    </div>
  </div>
</template>
