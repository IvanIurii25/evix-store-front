<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ProductCard from './ProductCard.vue';
import {
  listProducts,
  type ProductCard as PCard,
  type ProductSort,
  type FacetsResponse,
} from '../api/catalog';

const props = defineProps<{
  categorySlug: string;
  lang: string;
  initialProducts: PCard[];
  initialCursor: string | null;
  facets: FacetsResponse;
}>();

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'price_asc', label: 'Сначала дешёвые' },
  { value: 'price_desc', label: 'Сначала дорогие' },
];

const products = ref<PCard[]>(props.initialProducts);
const cursor = ref<string | null>(props.initialCursor);
const sort = ref<ProductSort>('newest');
const priceMin = ref<number | null>(null);
const priceMax = ref<number | null>(null);
const loading = ref(false);

function writeUrl() {
  const p = new URLSearchParams();
  if (sort.value !== 'newest') p.set('sort', sort.value);
  if (priceMin.value != null) p.set('price_min', String(priceMin.value));
  if (priceMax.value != null) p.set('price_max', String(priceMax.value));
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
}

async function reload() {
  loading.value = true;
  writeUrl();
  try {
    const res = await listProducts(props.categorySlug, props.lang, {
      sort: sort.value,
      priceMin: priceMin.value ?? undefined,
      priceMax: priceMax.value ?? undefined,
    });
    products.value = res.data;
    cursor.value = res.next_cursor ?? null;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!cursor.value) return;
  loading.value = true;
  try {
    const res = await listProducts(props.categorySlug, props.lang, {
      sort: sort.value,
      cursor: cursor.value,
      priceMin: priceMin.value ?? undefined,
      priceMax: priceMax.value ?? undefined,
    });
    products.value = [...products.value, ...res.data];
    cursor.value = res.next_cursor ?? null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  readUrl();
  const filtered =
    sort.value !== 'newest' || priceMin.value != null || priceMax.value != null;
  if (filtered) reload(); // restore state from a shared URL
});
</script>

<template>
  <div class="flex gap-6">
    <aside class="hidden w-64 shrink-0 lg:block">
      <div class="rounded-2xl border-2 border-fill p-4">
        <h3 class="text-sm font-semibold text-ink">Цена, MDL</h3>
        <div class="mt-3 flex items-center gap-2">
          <input
            v-model.number="priceMin"
            type="number"
            placeholder="от"
            class="w-full rounded-lg bg-fill px-2 py-1.5 text-sm outline-none"
          />
          <input
            v-model.number="priceMax"
            type="number"
            placeholder="до"
            class="w-full rounded-lg bg-fill px-2 py-1.5 text-sm outline-none"
          />
        </div>
        <button
          class="mt-3 w-full rounded-lg bg-primary py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          @click="reload"
        >
          Применить
        </button>

        <!-- Attribute facets: shown with counts. Filtering by them needs a
             backend param the listing endpoint doesn't take yet (display-only). -->
        <div
          v-for="a in facets.attributes ?? []"
          :key="a.attribute_id"
          class="mt-5"
        >
          <h3 class="text-sm font-semibold text-ink">{{ a.name }}</h3>
          <ul class="mt-2 space-y-1 text-sm text-subtle">
            <li v-for="v in a.values ?? []" :key="v.value_id">
              {{ v.value }} <span class="text-xs">({{ v.count }})</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <div class="flex-1">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-sm text-subtle">{{ products.length }} товаров</span>
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
        <ProductCard v-for="p in products" :key="p.product_id" :product="p" />
      </div>
      <p v-else class="text-subtle">В этой категории пока нет товаров.</p>

      <div v-if="cursor" class="mt-8 text-center">
        <button
          :disabled="loading"
          class="rounded-xl border-2 border-primary px-6 py-2 font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
          @click="loadMore"
        >
          {{ loading ? 'Загрузка…' : 'Показать ещё' }}
        </button>
      </div>
    </div>
  </div>
</template>
