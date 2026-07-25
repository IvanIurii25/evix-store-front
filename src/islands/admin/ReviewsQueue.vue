<script setup lang="ts">
import { onMounted, ref } from 'vue';

import {
  listAdminReviews,
  moderateReview,
  deleteAdminReview,
  type AdminReview,
} from '../../api/admin';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const items = ref<AdminReview[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const loadError = ref('');
const status = ref<StatusFilter>('pending'); // default: what needs attention
const busyId = ref<number | null>(null); // row-level action in flight

const STATUS_OPTS: { k: StatusFilter; l: string }[] = [
  { k: 'pending', l: 'На модерации' },
  { k: 'approved', l: 'Одобренные' },
  { k: 'rejected', l: 'Отклонённые' },
  { k: 'all', l: 'Все' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'на модерации',
  approved: 'одобрен',
  rejected: 'отклонён',
};

async function load(reset = true) {
  if (reset) {
    loading.value = true;
    loadError.value = '';
    items.value = [];
    nextCursor.value = null;
  } else {
    loadingMore.value = true;
  }
  try {
    const res = await listAdminReviews({
      status: status.value === 'all' ? null : status.value,
      cursor: reset ? null : nextCursor.value,
    });
    items.value = reset ? res.data : [...items.value, ...res.data];
    nextCursor.value = res.next_cursor ?? null;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}
onMounted(() => load(true));

function setFilter(next: StatusFilter) {
  if (status.value === next) return;
  status.value = next;
  void load(true);
}

function loadMore() {
  if (nextCursor.value) void load(false);
}

// After a moderation action a row may no longer match the active filter — drop
// it locally so the table + nav badge reflect the change immediately.
function dropIfFiltered(r: AdminReview) {
  if (status.value !== 'all' && r.status !== status.value) {
    items.value = items.value.filter((x) => x.id !== r.id);
  }
}

async function moderate(r: AdminReview, to: 'approved' | 'rejected') {
  busyId.value = r.id;
  try {
    const updated = await moderateReview(r.id, to);
    r.status = updated.status;
    r.moderated_at = updated.moderated_at;
    dropIfFiltered(r);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось обновить';
  } finally {
    busyId.value = null;
  }
}

async function remove(r: AdminReview) {
  if (!confirm('Удалить отзыв?')) return;
  busyId.value = r.id;
  try {
    await deleteAdminReview(r.id);
    items.value = items.value.filter((x) => x.id !== r.id);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось удалить';
  } finally {
    busyId.value = null;
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU');
}
const STARS = [1, 2, 3, 4, 5];
</script>

<template>
  <div
    v-if="loading"
    class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
  >
    Загрузка…
  </div>
  <div v-else class="space-y-5">
    <p
      v-if="loadError"
      class="rounded-2xl border-2 border-fill bg-white p-4 text-danger"
    >
      {{ loadError }}
    </p>

    <!-- Filter -->
    <div
      class="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-fill bg-white p-4"
    >
      <div class="flex overflow-hidden rounded-lg border-2 border-fill text-sm">
        <button
          v-for="opt in STATUS_OPTS"
          :key="opt.k"
          type="button"
          class="px-3 py-1.5 font-medium"
          :class="
            status === opt.k
              ? 'bg-primary text-white'
              : 'text-body hover:bg-fill'
          "
          @click="setFilter(opt.k)"
        >
          {{ opt.l }}
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto rounded-2xl border-2 border-fill bg-white">
      <table class="w-full text-sm">
        <thead class="border-b-2 border-fill text-left text-subtle">
          <tr>
            <th class="px-4 py-3 font-medium">Товар</th>
            <th class="px-4 py-3 font-medium">Автор</th>
            <th class="px-4 py-3 font-medium">Оценка</th>
            <th class="px-4 py-3 font-medium">Отзыв</th>
            <th class="px-4 py-3 font-medium">Статус</th>
            <th class="px-4 py-3 font-medium">Дата</th>
            <th class="px-4 py-3 text-right font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in items"
            :key="r.id"
            class="border-b border-fill align-top transition hover:bg-fill"
          >
            <td class="px-4 py-3">
              <a
                :href="`/admin/products/${r.product_id}`"
                class="font-medium text-ink hover:text-primary"
                >#{{ r.product_id }}</a
              >
            </td>
            <td class="px-4 py-3">
              <span class="text-ink">{{ r.author_name || 'Покупатель' }}</span>
              <span
                v-if="r.is_verified"
                class="ml-1 rounded bg-price/10 px-1.5 py-0.5 text-xs font-medium text-price"
                >✓ куплено</span
              >
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-amber-400">
              <span
                v-for="s in STARS"
                :key="s"
                :class="s <= r.rating ? '' : 'text-fill'"
                >★</span
              >
            </td>
            <td class="max-w-sm px-4 py-3">
              <p v-if="r.title" class="font-medium text-ink">{{ r.title }}</p>
              <p v-if="r.body" class="text-subtle">{{ r.body }}</p>
              <span v-if="!r.title && !r.body" class="text-subtle">—</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-md px-2 py-0.5 text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-700': r.status === 'pending',
                  'bg-price/10 text-price': r.status === 'approved',
                  'bg-danger/10 text-danger': r.status === 'rejected',
                }"
                >{{ STATUS_LABEL[r.status] ?? r.status }}</span
              >
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-subtle">
              {{ fmtDate(r.created_at) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <button
                v-if="r.status !== 'approved'"
                type="button"
                :disabled="busyId === r.id"
                class="rounded-lg border-2 border-fill px-3 py-1 font-medium text-price hover:bg-fill disabled:opacity-50"
                @click="moderate(r, 'approved')"
              >
                Одобрить
              </button>
              <button
                v-if="r.status !== 'rejected'"
                type="button"
                :disabled="busyId === r.id"
                class="ml-2 rounded-lg border-2 border-fill px-3 py-1 font-medium text-body hover:bg-fill disabled:opacity-50"
                @click="moderate(r, 'rejected')"
              >
                Отклонить
              </button>
              <button
                type="button"
                :disabled="busyId === r.id"
                class="ml-2 rounded-lg border-2 border-fill px-3 py-1 font-medium text-danger hover:bg-fill disabled:opacity-50"
                @click="remove(r)"
              >
                Удалить
              </button>
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="7" class="px-4 py-10 text-center text-subtle">
              Отзывов по этому фильтру нет.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      v-if="nextCursor"
      type="button"
      :disabled="loadingMore"
      class="rounded-xl border-2 border-fill px-5 py-2 text-sm font-medium text-body hover:bg-fill disabled:opacity-60"
      @click="loadMore"
    >
      {{ loadingMore ? '…' : 'Показать ещё' }}
    </button>
  </div>
</template>
