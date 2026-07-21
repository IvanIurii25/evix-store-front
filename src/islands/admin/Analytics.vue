<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  analyticsSummary,
  trafficSeries,
  type AnalyticsSummary,
  type TrafficSeries,
} from '../../api/admin';

const summary = ref<AnalyticsSummary | null>(null);
const series = ref<TrafficSeries | null>(null);
const loading = ref(true);
const error = ref('');

// --------------------------------------------------------------------------- //
// Date range — two <input type="date"> plus quick presets. Empty params fall
// back to the backend default (last 30 days).
// --------------------------------------------------------------------------- //
const dateFrom = ref('');
const dateTo = ref('');

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  const range: { date_from?: string; date_to?: string } = {};
  if (dateFrom.value) range.date_from = dateFrom.value;
  if (dateTo.value) range.date_to = dateTo.value;
  try {
    const [s, t] = await Promise.all([
      analyticsSummary(range),
      trafficSeries(range),
    ]);
    summary.value = s;
    series.value = t;
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Не удалось загрузить аналитику';
  } finally {
    loading.value = false;
  }
}

function preset(days: number): void {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  dateFrom.value = toIso(from);
  dateTo.value = toIso(to);
  load();
}

onMounted(load);

// --------------------------------------------------------------------------- //
// Formatting helpers.
// --------------------------------------------------------------------------- //
function num(value: number): string {
  return Number(value).toLocaleString('ru-RU');
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('ru-RU');
}

// --------------------------------------------------------------------------- //
// Traffic chart — two hand-drawn SVG polylines (pageviews + unique visitors)
// scaled to the max value across both series.
// --------------------------------------------------------------------------- //
const CHART_W = 600;
const CHART_H = 220;
const PAD = 12;

const points = computed(() => series.value?.data ?? []);

const chartMax = computed(() =>
  points.value.reduce(
    (max, p) => Math.max(max, p.pageviews, p.unique_visitors),
    0,
  ),
);

function polyline(key: 'pageviews' | 'unique_visitors'): string {
  const data = points.value;
  const peak = chartMax.value;
  if (data.length === 0 || peak <= 0) return '';
  const usableW = CHART_W - PAD * 2;
  const usableH = CHART_H - PAD * 2;
  const step = data.length > 1 ? usableW / (data.length - 1) : 0;
  return data
    .map((p, i) => {
      const x = PAD + step * i;
      const y = CHART_H - PAD - (p[key] / peak) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

const pageviewsLine = computed(() => polyline('pageviews'));
const uniqueLine = computed(() => polyline('unique_visitors'));

const firstDay = computed(() => points.value[0]?.day ?? '');
const lastDay = computed(
  () => points.value[points.value.length - 1]?.day ?? '',
);

// --------------------------------------------------------------------------- //
// Lists + device breakdown. Optional API fields are normalized to arrays.
// --------------------------------------------------------------------------- //
const topPaths = computed(() => summary.value?.top_paths ?? []);
const topReferrers = computed(() => summary.value?.top_referrers ?? []);

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Десктоп',
  mobile: 'Мобильные',
  tablet: 'Планшеты',
  bot: 'Боты',
};

function deviceLabel(name: string): string {
  return DEVICE_LABELS[name] ?? name;
}

const devices = computed(() => summary.value?.device_breakdown ?? []);

const deviceMax = computed(() =>
  devices.value.reduce((max, d) => Math.max(max, d.count), 0),
);

function devicePct(count: number): number {
  const peak = deviceMax.value;
  return peak > 0 ? (count / peak) * 100 : 0;
}
</script>

<template>
  <div>
    <!-- Date range controls -->
    <div class="rounded-2xl border-2 border-fill bg-white p-6">
      <div class="flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1 text-sm text-subtle">
          С даты
          <input
            v-model="dateFrom"
            type="date"
            class="rounded-xl border-2 border-fill px-3 py-2 text-body outline-none focus:border-primary"
            @change="load"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-subtle">
          По дату
          <input
            v-model="dateTo"
            type="date"
            class="rounded-xl border-2 border-fill px-3 py-2 text-body outline-none focus:border-primary"
            @change="load"
          />
        </label>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-xl border-2 border-fill px-3 py-2 text-sm font-medium text-body transition hover:border-primary hover:text-primary"
            @click="preset(7)"
          >
            7 дней
          </button>
          <button
            type="button"
            class="rounded-xl border-2 border-fill px-3 py-2 text-sm font-medium text-body transition hover:border-primary hover:text-primary"
            @click="preset(30)"
          >
            30 дней
          </button>
        </div>
      </div>
    </div>

    <p v-if="loading" class="mt-6 text-subtle">Загрузка…</p>
    <p v-else-if="error" class="mt-6 text-danger">{{ error }}</p>

    <div v-else-if="summary" class="mt-6 space-y-6">
      <!-- KPI cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Просмотры</p>
          <p class="mt-2 text-2xl font-bold text-primary">
            {{ num(summary.pageviews) }}
          </p>
        </div>

        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Уникальные посетители</p>
          <p class="mt-2 text-2xl font-bold text-ink">
            {{ num(summary.unique_visitors) }}
          </p>
        </div>

        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <p class="text-sm text-subtle">Боты</p>
          <p class="mt-2 text-2xl font-bold text-subtle">
            {{ num(summary.bot_pageviews) }}
          </p>
        </div>
      </div>

      <!-- Traffic chart -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-ink">Трафик по дням</h2>
          <div class="flex items-center gap-4 text-xs text-subtle">
            <span class="inline-flex items-center gap-1.5">
              <span class="inline-block h-0.5 w-4 bg-primary"></span>
              Просмотры
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="inline-block h-0.5 w-4 bg-price"></span>
              Уникальные
            </span>
          </div>
        </div>

        <div v-if="points.length && chartMax > 0" class="mt-4">
          <svg
            :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
            class="w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="График трафика по дням"
          >
            <polyline
              :points="pageviewsLine"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-primary"
              vector-effect="non-scaling-stroke"
            />
            <polyline
              :points="uniqueLine"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-price"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="mt-2 flex justify-between text-xs text-subtle">
            <span>{{ shortDate(firstDay) }}</span>
            <span>Максимум: {{ num(chartMax) }}</span>
            <span>{{ shortDate(lastDay) }}</span>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-subtle">Нет данных за период</p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Top paths -->
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h2 class="text-sm font-semibold text-ink">Топ страниц</h2>
          <ul v-if="topPaths.length" class="mt-4 space-y-3">
            <li
              v-for="(p, i) in topPaths"
              :key="`path-${i}`"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <span class="min-w-0 truncate font-mono text-body">{{
                p.name
              }}</span>
              <span class="shrink-0 text-subtle">{{ num(p.count) }}</span>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-subtle">Нет данных</p>
        </div>

        <!-- Top referrers -->
        <div class="rounded-2xl border-2 border-fill bg-white p-6">
          <h2 class="text-sm font-semibold text-ink">Источники</h2>
          <ul v-if="topReferrers.length" class="mt-4 space-y-3">
            <li
              v-for="(r, i) in topReferrers"
              :key="`ref-${i}`"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <span class="min-w-0 truncate text-body">{{ r.name }}</span>
              <span class="shrink-0 text-subtle">{{ num(r.count) }}</span>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-subtle">Нет данных</p>
        </div>
      </div>

      <!-- Device breakdown -->
      <div class="rounded-2xl border-2 border-fill bg-white p-6">
        <h2 class="text-sm font-semibold text-ink">Устройства</h2>
        <div v-if="devices.length" class="mt-4 space-y-3">
          <div v-for="(d, i) in devices" :key="`dev-${i}`" class="text-sm">
            <div class="flex items-center justify-between gap-4">
              <span class="text-body">{{ deviceLabel(d.name) }}</span>
              <span class="text-subtle">{{ num(d.count) }}</span>
            </div>
            <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-fill">
              <div
                class="h-full rounded-full bg-primary"
                :style="{ width: `${devicePct(d.count)}%` }"
              ></div>
            </div>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-subtle">Нет данных</p>
      </div>

      <p class="text-xs text-subtle">
        Данные собираются first-party, агрегировано; кросс-сессионный трекинг
        требует согласия пользователя.
      </p>
    </div>
  </div>
</template>
