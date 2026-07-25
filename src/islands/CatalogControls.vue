<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ProductCard from './ProductCard.vue';
import {
  listProducts,
  type ProductCard as PCard,
  type ProductSort,
  type FacetsResponse,
} from '../api/catalog';
import type { Lang } from '../lib/i18n';
import { listingStrings } from '../lib/i18n-strings';
import { productCount } from '../lib/format';

const props = defineProps<{
  categorySlug: string;
  lang: Lang;
  initialProducts: PCard[];
  initialCursor: string | null;
  facets: FacetsResponse;
}>();

const t = listingStrings(props.lang);

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: t.sortNewest },
  { value: 'price_asc', label: t.sortPriceAsc },
  { value: 'price_desc', label: t.sortPriceDesc },
];

const products = ref<PCard[]>(props.initialProducts);
const cursor = ref<string | null>(props.initialCursor);
const sort = ref<ProductSort>('newest');
const priceMin = ref<number | null>(null);
const priceMax = ref<number | null>(null);
const selectedValues = ref<number[]>([]);
const loading = ref(false);
const error = ref('');
// Re-runs the last failed fetch (reload or loadMore) when the user retries.
let retryFn: (() => Promise<void>) | null = null;

function optsFromState() {
  return {
    sort: sort.value,
    priceMin: priceMin.value ?? undefined,
    priceMax: priceMax.value ?? undefined,
    valueIds: selectedValues.value.length
      ? [...selectedValues.value]
      : undefined,
  };
}

function toggleValue(id: number) {
  const i = selectedValues.value.indexOf(id);
  if (i === -1) selectedValues.value.push(id);
  else selectedValues.value.splice(i, 1);
  reload();
}

function writeUrl() {
  const p = new URLSearchParams();
  if (sort.value !== 'newest') p.set('sort', sort.value);
  if (priceMin.value != null) p.set('price_min', String(priceMin.value));
  if (priceMax.value != null) p.set('price_max', String(priceMax.value));
  for (const v of selectedValues.value) p.append('value_ids', String(v));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  const s = p.get('sort') as ProductSort | null;
  if (s && SORTS.some((x) => x.value === s)) sort.value = s;
  const lo = p.get('price_min');
  const hi = p.get('price_max');
  if (lo) priceMin.value = Number(lo);
  if (hi) priceMax.value = Number(hi);
  selectedValues.value = p.getAll('value_ids').map(Number);
}

async function reload() {
  loading.value = true;
  error.value = '';
  writeUrl();
  try {
    const res = await listProducts(
      props.categorySlug,
      props.lang,
      optsFromState(),
    );
    products.value = res.data;
    cursor.value = res.next_cursor ?? null;
  } catch {
    error.value = t.loadError;
    retryFn = reload;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!cursor.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await listProducts(props.categorySlug, props.lang, {
      ...optsFromState(),
      cursor: cursor.value,
    });
    products.value = [...products.value, ...res.data];
    cursor.value = res.next_cursor ?? null;
  } catch {
    error.value = t.loadError;
    retryFn = loadMore;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  readUrl();
  const filtered =
    sort.value !== 'newest' ||
    priceMin.value != null ||
    priceMax.value != null ||
    selectedValues.value.length > 0;
  if (filtered) reload(); // restore state from a shared URL
});
</script>

<template>
  <div class="flex gap-6">
    <aside class="hidden w-64 shrink-0 lg:block">
      <div class="rounded-2xl border-2 border-fill p-4">
        <h3 class="text-sm font-semibold text-ink">{{ t.priceFilter }}</h3>
        <div class="mt-3 flex items-center gap-2">
          <input
            v-model.number="priceMin"
            type="number"
            :placeholder="t.priceFrom"
            class="w-full rounded-lg bg-fill px-2 py-1.5 text-sm outline-none"
          />
          <input
            v-model.number="priceMax"
            type="number"
            :placeholder="t.priceTo"
            class="w-full rounded-lg bg-fill px-2 py-1.5 text-sm outline-none"
          />
        </div>
        <button
          class="mt-3 w-full rounded-lg bg-primary py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          @click="reload"
        >
          {{ t.apply }}
        </button>

        <!-- Attribute facets: clickable filters (OR within, AND across attrs;
             backend value_ids param). -->
        <div
          v-for="a in facets.attributes ?? []"
          :key="a.attribute_id"
          class="mt-5"
        >
          <h3 class="text-sm font-semibold text-ink">{{ a.name }}</h3>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="v in a.values ?? []" :key="v.value_id">
              <label class="flex cursor-pointer items-center gap-2 text-body">
                <input
                  type="checkbox"
                  class="accent-primary"
                  :checked="selectedValues.includes(v.value_id)"
                  @change="toggleValue(v.value_id)"
                />
                <span
                  >{{ v.value }}
                  <span class="text-xs text-subtle">({{ v.count }})</span></span
                >
              </label>
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <div class="flex-1">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-sm text-subtle">{{
          productCount(products.length, props.lang)
        }}</span>
        <select
          v-model="sort"
          class="rounded-lg border-2 border-fill px-3 py-1.5 text-sm outline-none"
          @change="reload"
        >
          <option v-for="s in SORTS" :key="s.value" :value="s.value">
            {{ s.label }}
          </option>
        </select>
      </div>

      <div v-if="products.length" class="grid grid-cols-2 gap-6 md:grid-cols-3">
        <ProductCard
          v-for="p in products"
          :key="p.product_id"
          :product="p"
          :lang="props.lang"
        />
      </div>
      <p v-else class="text-subtle">{{ t.emptyCategory }}</p>

      <div v-if="error" class="mt-8 text-center">
        <p class="mb-2 text-sm text-danger">{{ error }}</p>
        <button
          :disabled="loading"
          class="rounded-xl border-2 border-primary px-6 py-2 font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
          @click="retryFn && retryFn()"
        >
          {{ loading ? t.loading : t.retry }}
        </button>
      </div>

      <div v-else-if="cursor" class="mt-8 text-center">
        <button
          :disabled="loading"
          class="rounded-xl border-2 border-primary px-6 py-2 font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
          @click="loadMore"
        >
          {{ loading ? t.loading : t.loadMore }}
        </button>
      </div>
    </div>
  </div>
</template>
