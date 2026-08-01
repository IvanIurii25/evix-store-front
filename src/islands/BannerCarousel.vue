<script setup lang="ts">
// Homepage carousel. No slider library: the track is a scroll-snap row, so
// swiping, momentum and keyboard scrolling are the browser's, and this island
// only adds what the browser will not do — autoplay, arrows and the dots.
//
// That also means the markup works before hydration and without JS: the slides
// are real content in the SSR HTML and the first one is already on screen.
//
// Sizing is fixed by aspect-ratio rather than by the image, so a slow creative
// cannot shift the page under the visitor (the homepage's CLS is 0 and stays 0).
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Banner } from '../api/site';
import { webpSrcset } from '../lib/img';
import { bannerStrings } from '../lib/i18n-strings';
import type { Lang } from '../lib/i18n';

const props = defineProps<{ lang: Lang; banners: Banner[] }>();

const t = bannerStrings(props.lang);

// Восемь секунд: на слайде есть заголовок, подзаголовок и цена — шести секунд
// не хватало, чтобы прочитать их и решить, кликать ли.
const AUTOPLAY_MS = 8000;

const track = ref<HTMLElement | null>(null);
const current = ref(0);
const paused = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let observer: IntersectionObserver | null = null;

const many = computed(() => props.banners.length > 1);

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function goTo(index: number) {
  const el = track.value;
  if (!el) return;
  const target = (index + props.banners.length) % props.banners.length;
  el.scrollTo({
    left: el.clientWidth * target,
    behavior: reducedMotion() ? 'auto' : 'smooth',
  });
  current.value = target;
}

function next() {
  goTo(current.value + 1);
}

function prev() {
  goTo(current.value - 1);
}

function startAutoplay() {
  // Motion that cannot be stopped is the complaint people have about carousels;
  // a visitor who asked for less of it gets a static first slide.
  if (timer !== null || !many.value || reducedMotion()) return;
  timer = setInterval(() => {
    if (!paused.value && document.visibilityState === 'visible') next();
  }, AUTOPLAY_MS);
}

function stopAutoplay() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function pause() {
  paused.value = true;
}

function resume() {
  paused.value = false;
}

onMounted(() => {
  // The dots follow the real scroll position, so a swipe and a click on an arrow
  // are the same event as far as the state is concerned.
  const el = track.value;
  if (el && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(
              (entry.target as HTMLElement).dataset.index ?? 0,
            );
            current.value = index;
          }
        }
      },
      { root: el, threshold: 0.6 },
    );
    for (const slide of el.querySelectorAll('[data-index]')) {
      observer.observe(slide);
    }
  }
  startAutoplay();
});

onUnmounted(() => {
  stopAutoplay();
  observer?.disconnect();
});
</script>

<template>
  <section
    class="mx-auto max-w-[1360px] px-5 pt-8"
    role="region"
    aria-roledescription="carousel"
    :aria-label="t.label"
    @mouseenter="pause"
    @mouseleave="resume"
    @focusin="pause"
    @focusout="resume"
  >
    <div class="relative">
      <div
        ref="track"
        class="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <component
          :is="banner.link_url ? 'a' : 'div'"
          v-for="(banner, index) in banners"
          :key="banner.id"
          :href="banner.link_url || undefined"
          :data-index="index"
          class="relative block w-full shrink-0 snap-center overflow-hidden bg-fill"
          role="group"
          aria-roledescription="slide"
          :aria-label="`${index + 1} / ${banners.length}`"
        >
          <picture>
            <source
              v-if="banner.image_mobile_url"
              media="(max-width: 767px)"
              type="image/webp"
              :srcset="webpSrcset(banner.image_mobile_url)"
              sizes="100vw"
            />
            <source
              v-if="banner.image_mobile_url"
              media="(max-width: 767px)"
              :srcset="banner.image_mobile_url"
            />
            <source
              type="image/webp"
              :srcset="webpSrcset(banner.image_url)"
              sizes="(min-width: 1360px) 1320px, 100vw"
            />
            <img
              :src="banner.image_url"
              :alt="banner.alt"
              :loading="index === 0 ? 'eager' : 'lazy'"
              :fetchpriority="index === 0 ? 'high' : undefined"
              decoding="async"
              class="aspect-[4/5] w-full object-cover md:aspect-[21/9]"
            />
          </picture>

          <div
            v-if="banner.title || banner.subtitle || banner.cta_label"
            class="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/65 via-black/20 to-transparent p-6 md:justify-center md:p-14"
          >
            <div class="max-w-xl">
              <p
                v-if="banner.title"
                class="text-2xl font-bold leading-tight text-white md:text-4xl"
              >
                {{ banner.title }}
              </p>
              <p
                v-if="banner.subtitle"
                class="mt-2 text-sm text-white/85 md:text-lg"
              >
                {{ banner.subtitle }}
              </p>
              <span
                v-if="banner.cta_label"
                class="mt-5 inline-block rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-primary"
              >
                {{ banner.cta_label }}
              </span>
            </div>
          </div>
        </component>
      </div>

      <template v-if="many">
        <button
          type="button"
          class="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:bg-white md:flex"
          :aria-label="t.prev"
          @click="prev"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M15 5l-7 7 7 7"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </button>
        <button
          type="button"
          class="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:bg-white md:flex"
          :aria-label="t.next"
          @click="next"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M9 5l7 7-7 7"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </button>

        <div class="mt-4 flex justify-center gap-2">
          <button
            v-for="(banner, index) in banners"
            :key="`dot-${banner.id}`"
            type="button"
            class="h-2.5 rounded-full transition-all"
            :class="
              index === current
                ? 'w-6 bg-primary'
                : 'w-2.5 bg-fill hover:bg-subtle'
            "
            :aria-label="`${t.goTo} ${index + 1}`"
            :aria-current="index === current ? 'true' : undefined"
            @click="goTo(index)"
          ></button>
        </div>
      </template>
    </div>
  </section>
</template>
