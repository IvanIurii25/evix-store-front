<script setup lang="ts">
import { ref } from 'vue';
import { logout } from '../api/auth';

const loading = ref(false);

async function doLogout() {
  loading.value = true;
  try {
    await logout();
  } finally {
    location.href = '/';
  }
}
</script>

<template>
  <button
    type="button"
    :disabled="loading"
    class="rounded-xl border-2 border-fill px-5 py-2 text-sm font-medium text-body transition hover:border-danger hover:text-danger disabled:opacity-50"
    @click="doLogout"
  >
    {{ loading ? '…' : 'Выйти' }}
  </button>
</template>
