<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  getProductReviews,
  submitReview,
  getMyReview,
  deleteMyReview,
  EMPTY_AGGREGATE,
  type RatingAggregate,
  type PublicReview,
  type ReviewOut,
  type ReviewSort,
} from '../api/reviews';
import { reviewCount } from '../lib/format';
import { localePath, type Lang } from '../lib/i18n';
import { reviewStrings } from '../lib/i18n-strings';

const props = defineProps<{
  productId: number;
  slug: string;
  lang: Lang;
  // SSR-seeded aggregate (from ProductDetail.rating_avg/count) so the header and
  // bars render instantly; refreshed with the full list on mount.
  initialAggregate?: RatingAggregate;
  // The product's own path (e.g. /ru/p/slug) — carried through login as `next`.
  productPath: string;
  // SSR-resolved auth (from the `access` cookie on the PDP). Guests never call
  // /reviews/mine, so no 401 is logged in the console.
  isLoggedIn?: boolean;
}>();

const t = reviewStrings(props.lang);

const aggregate = ref<RatingAggregate>(
  props.initialAggregate ?? EMPTY_AGGREGATE,
);
const reviews = ref<PublicReview[]>([]);
const nextCursor = ref<string | null>(null);
const sort = ref<ReviewSort>('newest');
const listLoading = ref(true);
const loadingMore = ref(false);

// The current viewer's own review (any status) + whether they are logged in.
const authed = ref<boolean | null>(null);
const myReview = ref<ReviewOut | null>(null);

// Form state.
const formOpen = ref(false);
const editing = ref(false);
const fRating = ref(0);
const fHover = ref(0);
const fTitle = ref('');
const fBody = ref('');
const fName = ref('');
const saving = ref(false);
const formError = ref('');
const submitted = ref(false);

const STARS = [1, 2, 3, 4, 5] as const;

// Rounded whole-star count for a 0..5 average (filled star threshold at .5).
function filledStars(avg: number | null | undefined): number {
  if (avg == null) return 0;
  return Math.round(avg);
}

const avgLabel = computed(() =>
  aggregate.value.average != null ? aggregate.value.average.toFixed(1) : '—',
);

const countLabel = computed(() =>
  reviewCount(aggregate.value.count, props.lang),
);

// Per-star bar percentages for the distribution (5★..1★).
const bars = computed(() => {
  const total = aggregate.value.count || 0;
  return [5, 4, 3, 2, 1].map((star) => {
    const n = aggregate.value.distribution?.[String(star)] ?? 0;
    return { star, n, pct: total > 0 ? Math.round((n / total) * 100) : 0 };
  });
});

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const loc = props.lang === 'ru' ? 'ru-RU' : 'ro-RO';
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(loc);
}

function statusLabel(status: string): string {
  if (status === 'approved') return t.statusApproved;
  if (status === 'rejected') return t.statusRejected;
  return t.statusPending;
}

async function loadList(reset = true) {
  if (reset) {
    listLoading.value = true;
    reviews.value = [];
    nextCursor.value = null;
  } else {
    loadingMore.value = true;
  }
  const res = await getProductReviews(props.slug, {
    lang: props.lang,
    sort: sort.value,
    cursor: reset ? undefined : (nextCursor.value ?? undefined),
  });
  aggregate.value = res.aggregate;
  reviews.value = reset ? res.data : [...reviews.value, ...res.data];
  nextCursor.value = res.next_cursor ?? null;
  listLoading.value = false;
  loadingMore.value = false;
}

function changeSort(next: ReviewSort) {
  if (sort.value === next) return;
  sort.value = next;
  void loadList(true);
}

function loadMore() {
  if (nextCursor.value) void loadList(false);
}

// Send a guest to login, carrying the product + intent so we auto-open the form.
function toLogin() {
  const next = `${props.productPath}?review=1`;
  location.href = `${localePath(props.lang, 'auth')}?next=${encodeURIComponent(next)}`;
}

function openForm() {
  if (authed.value === false) return toLogin();
  editing.value = false;
  fRating.value = 0;
  fTitle.value = '';
  fBody.value = '';
  fName.value = '';
  formError.value = '';
  submitted.value = false;
  formOpen.value = true;
}

function openEdit() {
  if (!myReview.value) return;
  editing.value = true;
  fRating.value = myReview.value.rating;
  fTitle.value = myReview.value.title ?? '';
  fBody.value = myReview.value.body ?? '';
  fName.value = myReview.value.author_name ?? '';
  formError.value = '';
  submitted.value = false;
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
}

async function save() {
  formError.value = '';
  if (fRating.value < 1 || fRating.value > 5) {
    formError.value = t.ratingRequired;
    return;
  }
  saving.value = true;
  const res = await submitReview({
    productId: props.productId,
    rating: fRating.value,
    title: fTitle.value.trim() || null,
    body: fBody.value.trim() || null,
    authorName: fName.value.trim() || null,
    lang: props.lang,
  });
  saving.value = false;
  if (!res.ok) {
    if (res.reason === 'guest') return toLogin();
    formError.value = res.message || t.submitError;
    return;
  }
  myReview.value = res.review;
  authed.value = true;
  submitted.value = true;
  formOpen.value = false;
}

async function removeMine() {
  if (!myReview.value) return;
  if (!confirm(t.removeConfirm)) return;
  await deleteMyReview(myReview.value.id);
  myReview.value = null;
  submitted.value = false;
  await loadList(true);
}

onMounted(async () => {
  const wantsForm = new URLSearchParams(location.search).get('review') === '1';
  if (wantsForm) {
    const url = new URL(location.href);
    url.searchParams.delete('review');
    history.replaceState({}, '', url);
  }
  await loadList(true);
  // A guest is known from SSR — skip /reviews/mine entirely (it would 401 and
  // log an error in the console). Only logged-in viewers fetch their own review.
  if (!props.isLoggedIn) {
    authed.value = false;
  } else {
    const mine = await getMyReview(props.productId);
    if (!mine.authed) {
      authed.value = false;
    } else {
      authed.value = true;
      myReview.value = mine.review;
    }
  }
  // Auto-open the form after a login redirect (only if they have no review yet).
  if (wantsForm && authed.value && !myReview.value) openForm();
});
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[280px_1fr]">
    <!-- Aggregate summary + distribution -->
    <div>
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-bold text-ink">{{ avgLabel }}</span>
        <span class="text-sm text-subtle">/ 5</span>
      </div>
      <div class="mt-1 flex items-center gap-1 text-lg text-amber-400">
        <span
          v-for="s in STARS"
          :key="s"
          :class="s <= filledStars(aggregate.average) ? '' : 'text-fill'"
          aria-hidden="true"
          >★</span
        >
      </div>
      <div class="mt-1 text-sm text-subtle">{{ countLabel }}</div>

      <div class="mt-4 space-y-1.5">
        <div
          v-for="b in bars"
          :key="b.star"
          class="flex items-center gap-2 text-xs text-subtle"
        >
          <span class="w-8 shrink-0 text-right">{{ b.star }}★</span>
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-fill">
            <div
              class="h-full rounded-full bg-amber-400"
              :style="{ width: b.pct + '%' }"
            ></div>
          </div>
          <span class="w-8 shrink-0 tabular-nums">{{ b.n }}</span>
        </div>
      </div>

      <!-- CTA / your-review panel -->
      <div class="mt-6">
        <p v-if="submitted" class="text-sm font-medium text-price">
          {{ t.submitted }}
        </p>

        <div v-else-if="myReview" class="rounded-xl border-2 border-fill p-4">
          <p class="text-sm font-semibold text-ink">{{ t.yourReview }}</p>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-amber-400" aria-hidden="true"
              ><span
                v-for="s in STARS"
                :key="s"
                :class="s <= myReview.rating ? '' : 'text-fill'"
                >★</span
              ></span
            >
            <span
              class="rounded-md bg-fill px-2 py-0.5 text-xs font-medium text-subtle"
              >{{ statusLabel(myReview.status) }}</span
            >
          </div>
          <p v-if="myReview.title" class="mt-2 text-sm font-medium text-ink">
            {{ myReview.title }}
          </p>
          <p v-if="myReview.body" class="mt-1 text-sm text-body">
            {{ myReview.body }}
          </p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="rounded-lg border-2 border-fill px-3 py-1 text-sm font-medium text-body hover:bg-fill"
              @click="openEdit"
            >
              {{ t.edit }}
            </button>
            <button
              type="button"
              class="rounded-lg border-2 border-fill px-3 py-1 text-sm font-medium text-danger hover:bg-fill"
              @click="removeMine"
            >
              {{ t.remove }}
            </button>
          </div>
        </div>

        <button
          v-else-if="!formOpen"
          type="button"
          class="h-11 w-full rounded-xl bg-primary px-4 font-semibold text-white transition hover:bg-primary-hover"
          @click="openForm"
        >
          {{ t.leaveReview }}
        </button>
      </div>
    </div>

    <!-- List + sort + form -->
    <div>
      <!-- Review form -->
      <form
        v-if="formOpen"
        class="mb-6 space-y-4 rounded-2xl border-2 border-fill p-5"
        @submit.prevent="save"
      >
        <div>
          <span class="text-sm font-medium text-body">{{ t.yourRating }}</span>
          <div
            class="mt-1 flex gap-1 text-3xl leading-none"
            @mouseleave="fHover = 0"
          >
            <button
              v-for="s in STARS"
              :key="s"
              type="button"
              class="transition"
              :class="s <= (fHover || fRating) ? 'text-amber-400' : 'text-fill'"
              :aria-label="String(s)"
              :aria-pressed="fRating === s"
              @mouseenter="fHover = s"
              @click="fRating = s"
            >
              ★
            </button>
          </div>
        </div>
        <input
          v-model="fTitle"
          type="text"
          :placeholder="t.titlePlaceholder"
          maxlength="120"
          class="w-full rounded-xl border-2 border-fill px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          v-model="fBody"
          :placeholder="t.bodyPlaceholder"
          rows="4"
          class="w-full rounded-xl border-2 border-fill px-3 py-2 text-sm outline-none focus:border-primary"
        ></textarea>
        <input
          v-model="fName"
          type="text"
          :placeholder="t.namePlaceholder"
          maxlength="80"
          class="w-full rounded-xl border-2 border-fill px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p v-if="formError" class="text-sm text-danger">{{ formError }}</p>
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="saving"
            class="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {{ saving ? t.submitting : editing ? t.save : t.submit }}
          </button>
          <button
            type="button"
            class="rounded-xl border-2 border-fill px-5 py-2 text-sm font-medium text-body hover:bg-fill"
            @click="closeForm"
          >
            {{ t.cancel }}
          </button>
        </div>
      </form>

      <!-- Sort -->
      <div
        v-if="aggregate.count > 0"
        class="mb-4 flex items-center gap-2 text-sm"
      >
        <span class="text-subtle">{{ t.sortLabel }}:</span>
        <div class="flex overflow-hidden rounded-lg border-2 border-fill">
          <button
            v-for="opt in [
              { k: 'newest', l: t.sortNewest },
              { k: 'highest', l: t.sortHighest },
              { k: 'lowest', l: t.sortLowest },
            ]"
            :key="opt.k"
            type="button"
            class="px-3 py-1.5 font-medium"
            :class="
              sort === opt.k
                ? 'bg-primary text-white'
                : 'text-body hover:bg-fill'
            "
            @click="changeSort(opt.k as ReviewSort)"
          >
            {{ opt.l }}
          </button>
        </div>
      </div>

      <div v-if="listLoading" class="text-sm text-subtle">…</div>
      <p
        v-else-if="reviews.length === 0"
        class="rounded-2xl border-2 border-fill p-6 text-sm text-subtle"
      >
        {{ t.noReviews }}
      </p>

      <ul v-else class="space-y-5">
        <li
          v-for="r in reviews"
          :key="r.id"
          class="border-b border-fill pb-5 last:border-0"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-ink">{{
              r.author_name || t.anonymous
            }}</span>
            <span
              v-if="r.is_verified"
              class="rounded-md bg-price/10 px-2 py-0.5 text-xs font-medium text-price"
              >{{ t.verifiedBadge }}</span
            >
            <span class="ml-auto text-xs text-subtle">{{
              fmtDate(r.created_at)
            }}</span>
          </div>
          <div class="mt-1 text-amber-400" aria-hidden="true">
            <span
              v-for="s in STARS"
              :key="s"
              :class="s <= r.rating ? '' : 'text-fill'"
              >★</span
            >
          </div>
          <p v-if="r.title" class="mt-2 font-medium text-ink">{{ r.title }}</p>
          <p v-if="r.body" class="mt-1 text-sm text-body">{{ r.body }}</p>
        </li>
      </ul>

      <button
        v-if="nextCursor"
        type="button"
        :disabled="loadingMore"
        class="mt-5 rounded-xl border-2 border-primary px-5 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-60"
        @click="loadMore"
      >
        {{ loadingMore ? '…' : t.loadMore }}
      </button>
    </div>
  </div>
</template>
