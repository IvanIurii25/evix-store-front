<script setup lang="ts">
// Back-office for the homepage carousel: the list with its display order on the
// left, one editor at a time on the right.
//
// The editor always submits both languages, because the storefront refuses a
// half-translated banner — so the tabs are two views of one payload, not two
// independent forms.
import { ref, computed, onMounted } from 'vue';
import {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
  uploadAsset,
  type BannerAdminOut,
  type BannerTranslationIn,
} from '../../api/admin';

type Lang = 'ru' | 'ro';

interface Draft {
  id: number | null;
  position: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  link_url: string;
  translations: Record<Lang, BannerTranslationIn>;
}

const LANGS: Lang[] = ['ru', 'ro'];

const banners = ref<BannerAdminOut[]>([]);
const draft = ref<Draft | null>(null);
const tab = ref<Lang>('ru');
const loading = ref(false);
const saving = ref(false);
const uploading = ref('');
const error = ref('');

function emptyTranslation(lang: Lang): BannerTranslationIn {
  return {
    lang,
    image_url: '',
    image_mobile_url: null,
    alt: '',
    title: null,
    subtitle: null,
    cta_label: null,
  };
}

// `datetime-local` speaks "2026-08-01T10:00", the API speaks ISO with a zone.
function toInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    banners.value = await listBanners();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function startNew() {
  draft.value = {
    id: null,
    position: banners.value.length,
    is_active: false,
    starts_at: '',
    ends_at: '',
    link_url: '',
    translations: { ru: emptyTranslation('ru'), ro: emptyTranslation('ro') },
  };
  tab.value = 'ru';
}

function edit(banner: BannerAdminOut) {
  const translations = {
    ru: emptyTranslation('ru'),
    ro: emptyTranslation('ro'),
  };
  for (const tr of banner.translations ?? []) {
    if (tr.lang === 'ru' || tr.lang === 'ro') {
      translations[tr.lang] = { ...tr } as BannerTranslationIn;
    }
  }
  draft.value = {
    id: banner.id,
    position: banner.position,
    is_active: banner.is_active,
    starts_at: toInput(banner.starts_at),
    ends_at: toInput(banner.ends_at),
    link_url: banner.link_url ?? '',
    translations,
  };
  tab.value = 'ru';
}

const currentTranslation = computed(() =>
  draft.value ? draft.value.translations[tab.value] : null,
);

// Both creatives and both alts are required by the API. Checking here too keeps
// the manager from discovering it as a 422 after filling in the other tab.
const missing = computed(() => {
  if (!draft.value) return [];
  const gaps: string[] = [];
  for (const lang of LANGS) {
    const tr = draft.value.translations[lang];
    if (!tr.image_url) gaps.push(`${lang.toUpperCase()}: картинка`);
    if (!tr.alt.trim()) gaps.push(`${lang.toUpperCase()}: alt`);
  }
  return gaps;
});

async function upload(event: Event, field: 'image_url' | 'image_mobile_url') {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !draft.value) return;
  uploading.value = field;
  error.value = '';
  try {
    draft.value.translations[tab.value][field] = await uploadAsset(file);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    uploading.value = '';
    input.value = '';
  }
}

async function save() {
  if (!draft.value || missing.value.length > 0) return;
  saving.value = true;
  error.value = '';
  const body = {
    position: draft.value.position,
    is_active: draft.value.is_active,
    starts_at: toIso(draft.value.starts_at),
    ends_at: toIso(draft.value.ends_at),
    link_url: draft.value.link_url.trim() || null,
    translations: LANGS.map((lang) => draft.value!.translations[lang]),
  };
  try {
    if (draft.value.id === null) await createBanner(body);
    else await updateBanner(draft.value.id, body);
    draft.value = null;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function remove(banner: BannerAdminOut) {
  if (!confirm(`Удалить баннер #${banner.id}?`)) return;
  error.value = '';
  try {
    await deleteBanner(banner.id);
    if (draft.value?.id === banner.id) draft.value = null;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= banners.value.length) return;
  const ordered = [...banners.value];
  const [moved] = ordered.splice(index, 1);
  ordered.splice(target, 0, moved);
  error.value = '';
  try {
    banners.value = await reorderBanners(
      ordered.map((b, position) => ({ banner_id: b.id, position })),
    );
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// What the storefront decides, restated for the person choosing the dates.
function state(banner: BannerAdminOut): string {
  if (!banner.is_active) return 'Выключен';
  const now = Date.now();
  if (banner.starts_at && new Date(banner.starts_at).getTime() > now)
    return 'Запланирован';
  if (banner.ends_at && new Date(banner.ends_at).getTime() < now)
    return 'Истёк';
  return 'Показывается';
}

function preview(banner: BannerAdminOut): string {
  const ru = (banner.translations ?? []).find((t) => t.lang === 'ru');
  return ru?.image_url ?? (banner.translations ?? [])[0]?.image_url ?? '';
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between gap-4">
      <h1 class="text-xl font-bold text-gray-900">Баннеры на главной</h1>
      <button
        type="button"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        @click="startNew"
      >
        Добавить баннер
      </button>
    </div>

    <p class="mb-4 text-sm text-gray-500">
      Порядок в списке — порядок слайдов. Витрина показывает только включённые
      баннеры внутри их дат; правки появляются на сайте в течение минуты.
    </p>

    <p
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
    >
      {{ error }}
    </p>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- List -->
      <div>
        <p v-if="loading" class="text-sm text-gray-500">Загрузка…</p>
        <p v-else-if="banners.length === 0" class="text-sm text-gray-500">
          Баннеров нет — на главной показывается стандартный блок.
        </p>
        <ul v-else class="space-y-3">
          <li
            v-for="(banner, index) in banners"
            :key="banner.id"
            class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
          >
            <img
              v-if="preview(banner)"
              :src="preview(banner)"
              alt=""
              class="h-14 w-24 shrink-0 rounded-lg object-cover"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-gray-900">
                {{
                  (banner.translations ?? []).find((t) => t.lang === 'ru')
                    ?.alt || `Баннер #${banner.id}`
                }}
              </p>
              <p class="text-xs text-gray-500">
                {{ state(banner) }}
                <span v-if="banner.link_url"> · {{ banner.link_url }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded p-1 text-gray-400 hover:text-gray-700"
                aria-label="Выше"
                :disabled="index === 0"
                @click="move(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="rounded p-1 text-gray-400 hover:text-gray-700"
                aria-label="Ниже"
                :disabled="index === banners.length - 1"
                @click="move(index, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="rounded px-2 py-1 text-sm text-blue-600 hover:underline"
                @click="edit(banner)"
              >
                Изменить
              </button>
              <button
                type="button"
                class="rounded px-2 py-1 text-sm text-red-600 hover:underline"
                @click="remove(banner)"
              >
                Удалить
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Editor -->
      <div v-if="draft" class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="mb-4 flex gap-2">
          <button
            v-for="lang in LANGS"
            :key="lang"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-semibold uppercase"
            :class="
              tab === lang
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
            "
            @click="tab = lang"
          >
            {{ lang }}
          </button>
        </div>

        <div v-if="currentTranslation" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">
              Картинка (десктоп, широкая — 21:9)
            </label>
            <input
              type="file"
              accept="image/*"
              class="mt-1 block w-full text-sm"
              @change="(e) => upload(e, 'image_url')"
            />
            <img
              v-if="currentTranslation.image_url"
              :src="currentTranslation.image_url"
              alt=""
              class="mt-2 aspect-[21/9] w-full rounded-lg object-cover"
            />
            <p v-if="uploading === 'image_url'" class="text-xs text-gray-500">
              Загрузка…
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">
              Картинка для телефона (вертикальная — 4:5, необязательно)
            </label>
            <input
              type="file"
              accept="image/*"
              class="mt-1 block w-full text-sm"
              @change="(e) => upload(e, 'image_mobile_url')"
            />
            <img
              v-if="currentTranslation.image_mobile_url"
              :src="currentTranslation.image_mobile_url"
              alt=""
              class="mt-2 aspect-[4/5] w-40 rounded-lg object-cover"
            />
            <p
              v-if="uploading === 'image_mobile_url'"
              class="text-xs text-gray-500"
            >
              Загрузка…
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">
              Alt — описание для незрячих и поиска (обязательно)
            </label>
            <input
              v-model="currentTranslation.alt"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <p class="pt-2 text-xs text-gray-500">
            Поля ниже необязательны. Пусто — показывается только картинка;
            заполнено — текст рисуется поверх неё.
          </p>

          <input
            v-model="currentTranslation.title"
            type="text"
            placeholder="Заголовок"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            v-model="currentTranslation.subtitle"
            type="text"
            placeholder="Подзаголовок"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            v-model="currentTranslation.cta_label"
            type="text"
            placeholder="Надпись на кнопке"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <hr class="my-4 border-gray-200" />

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">
              Ссылка (например /ru/c/dom или https://…)
            </label>
            <input
              v-model="draft.link_url"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">
                Показывать с
              </label>
              <input
                v-model="draft.starts_at"
                type="datetime-local"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">
                Показывать до
              </label>
              <input
                v-model="draft.ends_at"
                type="datetime-local"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="draft.is_active" type="checkbox" />
            Включён
          </label>
        </div>

        <p v-if="missing.length > 0" class="mt-3 text-xs text-amber-700">
          Заполните для обоих языков: {{ missing.join(', ') }}
        </p>

        <div class="mt-4 flex gap-2">
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="saving || missing.length > 0"
            @click="save"
          >
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700"
            @click="draft = null"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
