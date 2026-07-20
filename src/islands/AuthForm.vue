<script setup lang="ts">
import { ref } from 'vue';
import { login, register } from '../api/auth';
import { mergeCart } from '../api/cart';
import { localePath, type Lang } from '../lib/i18n';

const props = defineProps<{ next?: string; lang: Lang }>();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const phone = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  if (password.value.length < 6) {
    error.value = 'Пароль — минимум 6 символов';
    return;
  }
  loading.value = true;
  try {
    if (mode.value === 'register') {
      if (!email.value.includes('@')) {
        error.value = 'Введите корректный email';
        return;
      }
      await register(email.value, password.value, phone.value || undefined);
      // register creates the account but does not set the session cookie —
      // log in right after so the httpOnly cookies are established.
      await login({ email: email.value }, password.value);
    } else {
      const ident = email.value.includes('@')
        ? { email: email.value }
        : { phone: email.value };
      await login(ident, password.value);
    }
    try {
      await mergeCart();
    } catch {
      /* merge is best-effort */
    }
    const next = props.next;
    location.href =
      next && next.startsWith('/') ? next : localePath(props.lang, 'account');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm rounded-2xl border-2 border-fill p-6">
    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 rounded-lg py-2 text-sm font-medium transition"
        :class="mode === 'login' ? 'bg-primary text-white' : 'text-subtle'"
        @click="mode = 'login'"
      >
        Вход
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg py-2 text-sm font-medium transition"
        :class="mode === 'register' ? 'bg-primary text-white' : 'text-subtle'"
        @click="mode = 'register'"
      >
        Регистрация
      </button>
    </div>

    <form class="mt-5 space-y-3" @submit.prevent="submit">
      <input
        v-model="email"
        :placeholder="mode === 'login' ? 'Email или телефон' : 'Email'"
        class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
      />
      <input
        v-if="mode === 'register'"
        v-model="phone"
        placeholder="Телефон (необязательно)"
        class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
      />
      <input
        v-model="password"
        type="password"
        placeholder="Пароль"
        class="w-full rounded-lg bg-fill px-3 py-2 outline-none"
      />
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-xl bg-primary py-2.5 font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
      >
        {{ loading ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться' }}
      </button>
    </form>
  </div>
</template>
