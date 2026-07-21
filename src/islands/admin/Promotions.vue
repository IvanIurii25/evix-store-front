<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  getProduct,
  listProducts,
  updateProduct,
  type ProductSearchItem,
} from '../../api/admin';

// --------------------------------------------------------------------------- //
// A product is "on sale" when old_price is set AND old_price > price:
// old_price = struck-through original, price = current discounted price.
// v1 has no campaign engine — sales are driven purely by the manual
// old_price field on each product.
// --------------------------------------------------------------------------- //

const onSale = ref<ProductSearchItem[]>([]);
const loading = ref(true);
const error = ref('');

function money(x: string | number): string {
  return `${Number(x).toLocaleString('ru-RU')} L`;
}

// Discount percentage from the two prices, rounded to a whole number.
function discountPercent(oldPrice: string, price: string): number {
  const original = Number(oldPrice);
  const current = Number(price);
  if (!(original > 0) || !(current >= 0) || current >= original) return 0;
  return Math.round((1 - current / original) * 100);
}

const isEmpty = computed(
  () => !loading.value && !error.value && onSale.value.length === 0,
);

async function loadOnSale() {
  loading.value = true;
  error.value = '';
  try {
    onSale.value = await listProducts({ on_sale: true });
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось загрузить акции';
  } finally {
    loading.value = false;
  }
}

onMounted(loadOnSale);

// --------------------------------------------------------------------------- //
// Inline edit of an existing sale (price + old_price on one row).
// --------------------------------------------------------------------------- //
const editingId = ref<number | null>(null);
const editPrice = ref('');
const editOldPrice = ref('');
const rowBusy = ref<number | null>(null);
const rowError = ref('');

function startEdit(row: ProductSearchItem, oldPrice: string) {
  editingId.value = row.id;
  editPrice.value = row.price;
  editOldPrice.value = oldPrice;
  rowError.value = '';
}

function cancelEdit() {
  editingId.value = null;
  rowError.value = '';
}

// Cache of old_price per product id (the search list item has no old_price,
// so we fetch the full product once to reveal the struck-through original).
const oldPrices = ref<Record<number, string>>({});

async function hydrateOldPrices(rows: ProductSearchItem[]) {
  const results = await Promise.all(
    rows.map(async (row) => {
      try {
        const full = await getProduct(row.id);
        return [row.id, full.old_price] as const;
      } catch {
        return [row.id, null] as const;
      }
    }),
  );
  const next: Record<number, string> = {};
  for (const [id, oldPrice] of results) {
    if (oldPrice != null) next[id] = oldPrice;
  }
  oldPrices.value = next;
}

// Fetch the per-row old_price whenever the on-sale list changes.
async function refresh() {
  await loadOnSale();
  await hydrateOldPrices(onSale.value);
}

onMounted(() => hydrateOldPrices(onSale.value));

function oldPriceFor(id: number): string {
  return oldPrices.value[id] ?? '';
}

async function saveEdit(id: number) {
  const price = Number(editPrice.value);
  const oldPrice = Number(editOldPrice.value);
  rowError.value = '';

  if (!(price > 0) || !(oldPrice > 0)) {
    rowError.value = 'Цены должны быть больше нуля';
    return;
  }
  if (price >= oldPrice) {
    rowError.value = 'Цена акции должна быть меньше старой цены';
    return;
  }

  rowBusy.value = id;
  try {
    await updateProduct(id, {
      price: editPrice.value,
      old_price: editOldPrice.value,
    });
    editingId.value = null;
    await refresh();
  } catch (e) {
    rowError.value = e instanceof Error ? e.message : 'Не удалось сохранить';
  } finally {
    rowBusy.value = null;
  }
}

async function removeSale(row: ProductSearchItem) {
  const label = row.name || row.code;
  if (!window.confirm(`Снять акцию с товара «${label}»?`)) return;

  rowBusy.value = row.id;
  rowError.value = '';
  try {
    // Clearing old_price takes the product off sale; price stays as-is.
    await updateProduct(row.id, { old_price: null });
    await refresh();
  } catch (e) {
    rowError.value = e instanceof Error ? e.message : 'Не удалось снять акцию';
  } finally {
    rowBusy.value = null;
  }
}

// --------------------------------------------------------------------------- //
// "Add product to sale" — search, pick, set a lower sale price.
// --------------------------------------------------------------------------- //
const search = ref('');
const searchResults = ref<ProductSearchItem[]>([]);
const searching = ref(false);
const searchError = ref('');

let searchTimer: ReturnType<typeof setTimeout> | undefined;

function onSearchInput() {
  clearTimeout(searchTimer);
  const term = search.value.trim();
  if (!term) {
    searchResults.value = [];
    searchError.value = '';
    return;
  }
  searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  searching.value = true;
  searchError.value = '';
  try {
    searchResults.value = await listProducts({ search: search.value.trim() });
  } catch (e) {
    searchError.value = e instanceof Error ? e.message : 'Ошибка поиска';
  } finally {
    searching.value = false;
  }
}

// Candidate picked from search — small form to enter the sale price.
const picked = ref<ProductSearchItem | null>(null);
const salePrice = ref('');
const addBusy = ref(false);
const addError = ref('');

function pick(product: ProductSearchItem) {
  picked.value = product;
  salePrice.value = '';
  addError.value = '';
}

function cancelPick() {
  picked.value = null;
  addError.value = '';
}

const previewDiscount = computed(() => {
  if (!picked.value) return 0;
  return discountPercent(picked.value.price, salePrice.value);
});

async function putOnSale() {
  const product = picked.value;
  if (!product) return;

  const current = Number(product.price);
  const sale = Number(salePrice.value);
  addError.value = '';

  if (!(sale > 0)) {
    addError.value = 'Введите цену акции больше нуля';
    return;
  }
  if (sale >= current) {
    addError.value = 'Цена акции должна быть меньше текущей цены';
    return;
  }

  addBusy.value = true;
  try {
    // old_price captures the current price as the struck-through original,
    // price drops to the sale price.
    await updateProduct(product.id, {
      old_price: product.price,
      price: salePrice.value,
    });
    picked.value = null;
    search.value = '';
    searchResults.value = [];
    await refresh();
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Не удалось добавить';
  } finally {
    addBusy.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- ------------------------------------------------------------------ -->
    <!-- Add product to sale                                                -->
    <!-- ------------------------------------------------------------------ -->
    <div class="rounded-2xl border-2 border-fill bg-white p-6">
      <h2 class="text-sm font-semibold text-ink">Добавить товар в акцию</h2>

      <input
        v-model="search"
        type="search"
        placeholder="Поиск товара по коду или названию…"
        class="mt-4 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
        @input="onSearchInput"
      />

      <p v-if="searching" class="mt-3 text-sm text-subtle">Поиск…</p>
      <p v-else-if="searchError" class="mt-3 text-sm text-danger">
        {{ searchError }}
      </p>

      <!-- Search results -->
      <ul
        v-else-if="searchResults.length"
        class="mt-3 divide-y divide-fill overflow-hidden rounded-xl border-2 border-fill"
      >
        <li
          v-for="product in searchResults"
          :key="product.id"
          class="flex items-center justify-between gap-4 px-4 py-3 text-sm"
        >
          <span class="min-w-0">
            <span class="font-mono text-body">{{ product.code }}</span>
            <span class="ml-2 text-ink">{{
              product.name || '— без названия —'
            }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-4">
            <span class="font-medium text-price">{{
              money(product.price)
            }}</span>
            <button
              type="button"
              class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
              @click="pick(product)"
            >
              В акцию
            </button>
          </span>
        </li>
      </ul>

      <p
        v-else-if="search.trim() && !searching"
        class="mt-3 text-sm text-subtle"
      >
        Ничего не найдено
      </p>

      <!-- Sale-price form for the picked product -->
      <div
        v-if="picked"
        class="mt-4 rounded-xl border-2 border-primary bg-fill p-4"
      >
        <p class="text-sm text-body">
          <span class="font-mono">{{ picked.code }}</span>
          <span class="ml-2 text-ink">{{
            picked.name || '— без названия —'
          }}</span>
        </p>
        <p class="mt-1 text-sm text-subtle">
          Текущая цена (станет старой):
          <span class="font-medium text-body">{{ money(picked.price) }}</span>
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <input
            v-model="salePrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="Цена по акции"
            class="w-48 rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
          />
          <span
            v-if="previewDiscount > 0"
            class="rounded-lg bg-badge-sale-bg px-2 py-1 text-sm font-semibold text-badge-sale"
          >
            -{{ previewDiscount }}%
          </span>
          <button
            type="button"
            :disabled="addBusy"
            class="rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            @click="putOnSale"
          >
            {{ addBusy ? 'Сохранение…' : 'Запустить акцию' }}
          </button>
          <button
            type="button"
            class="rounded-xl border-2 border-fill px-4 py-2 font-medium text-body hover:border-primary"
            @click="cancelPick"
          >
            Отмена
          </button>
        </div>

        <p v-if="addError" class="mt-2 text-sm text-danger">{{ addError }}</p>
      </div>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Active sales                                                       -->
    <!-- ------------------------------------------------------------------ -->
    <div
      v-if="loading"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
    >
      Загрузка…
    </div>

    <div
      v-else-if="error"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-danger"
    >
      {{ error }}
    </div>

    <div
      v-else-if="isEmpty"
      class="rounded-2xl border-2 border-fill bg-white p-10 text-center text-subtle"
    >
      Активных акций нет
    </div>

    <div
      v-else
      class="overflow-hidden rounded-2xl border-2 border-fill bg-white"
    >
      <table class="w-full text-sm">
        <thead class="border-b-2 border-fill text-left text-subtle">
          <tr>
            <th class="px-4 py-3 font-medium">Код</th>
            <th class="px-4 py-3 font-medium">Название</th>
            <th class="px-4 py-3 font-medium">Старая цена</th>
            <th class="px-4 py-3 font-medium">Цена сейчас</th>
            <th class="px-4 py-3 font-medium">Скидка</th>
            <th class="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="p in onSale" :key="p.id">
            <tr class="border-b border-fill last:border-0 hover:bg-fill">
              <td class="px-4 py-3 font-mono text-body">{{ p.code }}</td>
              <td class="px-4 py-3 text-ink">
                {{ p.name || '— без названия —' }}
              </td>

              <!-- Old price (struck through) -->
              <td class="px-4 py-3">
                <template v-if="editingId === p.id">
                  <input
                    v-model="editOldPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-28 rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
                  />
                </template>
                <span
                  v-else-if="oldPriceFor(p.id)"
                  class="text-subtle line-through"
                >
                  {{ money(oldPriceFor(p.id)) }}
                </span>
                <span v-else class="text-subtle">—</span>
              </td>

              <!-- Current (discounted) price -->
              <td class="px-4 py-3">
                <template v-if="editingId === p.id">
                  <input
                    v-model="editPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-28 rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
                  />
                </template>
                <span v-else class="font-medium text-price">{{
                  money(p.price)
                }}</span>
              </td>

              <!-- Discount badge -->
              <td class="px-4 py-3">
                <span
                  v-if="discountPercent(oldPriceFor(p.id), p.price) > 0"
                  class="rounded-lg bg-badge-sale-bg px-2 py-1 text-xs font-semibold text-badge-sale"
                >
                  -{{ discountPercent(oldPriceFor(p.id), p.price) }}%
                </span>
                <span v-else class="text-subtle">—</span>
              </td>

              <!-- Actions -->
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <template v-if="editingId === p.id">
                    <button
                      type="button"
                      :disabled="rowBusy === p.id"
                      class="rounded-xl bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                      @click="saveEdit(p.id)"
                    >
                      {{ rowBusy === p.id ? 'Сохранение…' : 'Сохранить' }}
                    </button>
                    <button
                      type="button"
                      class="rounded-xl border-2 border-fill px-3 py-1.5 font-medium text-body hover:border-primary"
                      @click="cancelEdit"
                    >
                      Отмена
                    </button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="rounded-xl border-2 border-fill px-3 py-1.5 font-medium text-body hover:border-primary"
                      @click="startEdit(p, oldPriceFor(p.id))"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      :disabled="rowBusy === p.id"
                      class="rounded-xl border-2 border-danger px-3 py-1.5 font-medium text-danger hover:bg-danger hover:text-white disabled:opacity-60"
                      @click="removeSale(p)"
                    >
                      Снять акцию
                    </button>
                  </template>
                </div>
              </td>
            </tr>

            <!-- Inline row error -->
            <tr v-if="rowError && editingId === p.id">
              <td colspan="6" class="px-4 pb-3 text-sm text-danger">
                {{ rowError }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
