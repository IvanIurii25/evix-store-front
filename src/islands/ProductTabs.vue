<script setup lang="ts">
import { ref, computed } from 'vue';

import { optimizeDescriptionHtml } from '../lib/description';
import type { Lang } from '../lib/i18n';
import { pdpStrings } from '../lib/i18n-strings';

interface Attr {
  name: string;
  values?: (string | null)[] | null;
}

const props = defineProps<{
  description?: string | null;
  attributes?: Attr[] | null;
  lang: Lang;
}>();

const t = pdpStrings(props.lang);

const hasDescription = computed(() => Boolean(props.description));
// Sanitized + image-optimized HTML for v-html (source renders as escaped text
// otherwise, and its media images are served as lazy WebP).
const descriptionHtml = computed(() =>
  optimizeDescriptionHtml(props.description),
);
const hasAttributes = computed(() => (props.attributes?.length ?? 0) > 0);

type TabKey = 'description' | 'attributes';
// Default to whichever section exists first. Both panels stay in the DOM
// (v-show) so the content is present in SSR HTML for SEO.
const active = ref<TabKey>(hasDescription.value ? 'description' : 'attributes');

const tabClass = (isActive: boolean) =>
  isActive
    ? 'border-primary text-ink'
    : 'border-transparent text-subtle hover:text-ink';
</script>

<template>
  <div v-if="hasDescription || hasAttributes" class="mt-8">
    <div class="flex gap-6 border-b border-fill" role="tablist">
      <button
        v-if="hasDescription"
        type="button"
        role="tab"
        :aria-selected="active === 'description'"
        class="-mb-px border-b-2 pb-2 text-sm font-semibold transition"
        :class="tabClass(active === 'description')"
        @click="active = 'description'"
      >
        {{ t.tabDescription }}
      </button>
      <button
        v-if="hasAttributes"
        type="button"
        role="tab"
        :aria-selected="active === 'attributes'"
        class="-mb-px border-b-2 pb-2 text-sm font-semibold transition"
        :class="tabClass(active === 'attributes')"
        @click="active = 'attributes'"
      >
        {{ t.tabAttributes }}
      </button>
    </div>

    <div
      v-show="hasDescription && active === 'description'"
      role="tabpanel"
      class="prod-description mt-4 text-body"
      v-html="descriptionHtml"
    ></div>

    <div
      v-show="hasAttributes && active === 'attributes'"
      role="tabpanel"
      class="mt-4"
    >
      <dl class="divide-y divide-fill">
        <div
          v-for="a in attributes"
          :key="a.name"
          class="flex justify-between gap-4 py-2 text-sm"
        >
          <dt class="text-subtle">{{ a.name }}</dt>
          <dd class="text-right text-ink">{{ (a.values ?? []).join(', ') }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
/* v-html'd product description: keep imported images responsive + readable flow. */
.prod-description :deep(img),
.prod-description :deep(picture) {
  max-width: 100%;
  height: auto;
  margin: 0.75rem auto;
  display: block;
}
.prod-description :deep(p) {
  line-height: 1.7;
  margin-bottom: 0.75rem;
}
.prod-description :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
