<script setup lang="ts">
import { ref } from 'vue';

import { login } from '../../api/auth';

const props = defineProps<{ next?: string }>();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  if (!email.value || !password.value) {
    error.value = 'Введите email и пароль';
    return;
  }
  busy.value = true;
  try {
    await login({ email: email.value }, password.value);
    // Full navigation so the SSR guard re-runs with the fresh cookie.
    window.location.href = props.next || '/admin';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка входа';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form
    class="w-full max-w-sm rounded-2xl border-2 border-fill bg-white p-8"
    @submit.prevent="submit"
  >
    <h1 class="text-xl font-bold text-ink">Вход в админку</h1>
    <p class="mt-1 text-sm text-subtle">Доступ только для сотрудников</p>

    <label class="mt-6 block text-sm font-medium text-body">Email</label>
    <input
      v-model="email"
      type="email"
      autocomplete="username"
      class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
    />

    <label class="mt-4 block text-sm font-medium text-body">Пароль</label>
    <input
      v-model="password"
      type="password"
      autocomplete="current-password"
      class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      @keyup.enter="submit"
    />

    <p v-if="error" class="mt-3 text-sm text-danger">{{ error }}</p>

    <button
      type="submit"
      :disabled="busy"
      class="mt-6 w-full rounded-xl bg-primary py-2.5 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
    >
      {{ busy ? 'Входим…' : 'Войти' }}
    </button>
  </form>
</template>
