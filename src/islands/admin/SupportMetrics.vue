<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { getSupportMetrics, type SupportMetricsOut } from '../../api/support';

const days = ref(30);
const data = ref<SupportMetricsOut | null>(null);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    data.value = await getSupportMetrics(days.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(days, load);

function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return `${h} ч ${m % 60} мин`;
}

// --- SVG bar chart of new conversations per day (mirrors admin Dashboard) --- //
const CHART_W = 640;
const CHART_H = 160;
const PAD = 24;
const series = computed(() => data.value?.series ?? []);
const maxCount = computed(() =>
  Math.max(1, ...series.value.map((p) => p.count)),
);
const bars = computed(() => {
  const pts = series.value;
  if (!pts.length) return [];
  const usableW = CHART_W - PAD * 2;
  const usableH = CHART_H - PAD * 2;
  const bw = usableW / pts.length;
  return pts.map((p, i) => {
    const h = (p.count / maxCount.value) * usableH;
    return {
      x: PAD + i * bw + bw * 0.15,
      y: PAD + (usableH - h),
      w: bw * 0.7,
      h,
      count: p.count,
      day: p.day,
    };
  });
});
</script>

<template>
  <div class="space-y-5">
    <!-- Range selector -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-subtle">Период:</span>
      <select
        v-model.number="days"
        class="rounded-xl border-2 border-fill px-3 py-1.5 outline-none focus:border-primary"
      >
        <option :value="7">7 дней</option>
        <option :value="30">30 дней</option>
        <option :value="90">90 дней</option>
      </select>
    </div>

    <div v-if="loading" class="text-subtle">Загрузка…</div>
    <div v-else-if="error" class="text-danger">{{ error }}</div>

    <template v-else-if="data">
      <!-- Stat cards -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="rounded-2xl border-2 border-fill bg-white p-4">
          <p class="text-xs text-subtle">Новых за период</p>
          <p class="mt-1 text-2xl font-semibold text-ink">
            {{ data.new_in_period }}
          </p>
        </div>
        <div class="rounded-2xl border-2 border-fill bg-white p-4">
          <p class="text-xs text-subtle">Без ответа</p>
          <p
            class="mt-1 text-2xl font-semibold"
            :class="data.unanswered > 0 ? 'text-danger' : 'text-ink'"
          >
            {{ data.unanswered }}
          </p>
        </div>
        <div class="rounded-2xl border-2 border-fill bg-white p-4">
          <p class="text-xs text-subtle">Ср. время ответа</p>
          <p class="mt-1 text-2xl font-semibold text-ink">
            {{ fmtDuration(data.avg_first_response_seconds) }}
          </p>
        </div>
        <div class="rounded-2xl border-2 border-fill bg-white p-4">
          <p class="text-xs text-subtle">Диалогов всего</p>
          <p class="mt-1 text-2xl font-semibold text-ink">{{ data.total }}</p>
        </div>
      </div>

      <!-- Status breakdown -->
      <div class="flex flex-wrap gap-3">
        <span class="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
          Открыто: {{ data.open }}
        </span>
        <span
          class="rounded-full bg-badge-sale-bg px-3 py-1 text-sm text-badge-sale"
        >
          Ждут: {{ data.pending }}
        </span>
        <span class="rounded-full bg-fill px-3 py-1 text-sm text-subtle">
          Закрыто: {{ data.closed }}
        </span>
      </div>

      <!-- Daily new-conversation chart -->
      <div class="rounded-2xl border-2 border-fill bg-white p-4">
        <p class="mb-2 text-sm font-medium text-ink">Новые диалоги по дням</p>
        <div v-if="!series.length" class="py-8 text-center text-sm text-subtle">
          Нет данных за период
        </div>
        <svg
          v-else
          :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
          class="w-full"
          preserveAspectRatio="none"
        >
          <rect
            v-for="(b, i) in bars"
            :key="i"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            rx="3"
            class="fill-primary/70"
          >
            <title>{{ b.day }}: {{ b.count }}</title>
          </rect>
        </svg>
      </div>
    </template>
  </div>
</template>
