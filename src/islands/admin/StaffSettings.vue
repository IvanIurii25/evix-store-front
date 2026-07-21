<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  createStaff,
  listStaff,
  updateStaff,
  type StaffItem,
} from '../../api/admin';

const items = ref<StaffItem[]>([]);
const loading = ref(true);
const error = ref('');

// Per-row busy guard so toggling one member doesn't disable the whole table.
const rowBusy = ref<number | null>(null);

// New-member form state.
const newEmail = ref('');
const newPassword = ref('');
const newPhone = ref('');
const formError = ref('');
const formSuccess = ref('');
const creating = ref(false);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await listStaff();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const isEmpty = computed(
  () => !loading.value && !error.value && items.value.length === 0,
);

function formatDate(x: string): string {
  return new Date(x).toLocaleDateString('ru-RU');
}

async function toggleActive(row: StaffItem) {
  rowBusy.value = row.id;
  error.value = '';
  try {
    const updated = await updateStaff(row.id, { is_active: !row.is_active });
    Object.assign(row, updated);
  } catch (e) {
    // Surfaces the backend "last active staff" refusal, among others.
    error.value = e instanceof Error ? e.message : 'Не удалось обновить';
  } finally {
    rowBusy.value = null;
  }
}

async function revokeAccess(row: StaffItem) {
  if (
    !window.confirm(
      `Снять доступ сотрудника ${row.email}? Он больше не сможет входить в админку.`,
    )
  ) {
    return;
  }
  rowBusy.value = row.id;
  error.value = '';
  try {
    const updated = await updateStaff(row.id, { is_staff: false });
    Object.assign(row, updated);
    // A revoked member is no longer staff — drop them from the list.
    items.value = items.value.filter((s) => s.is_staff);
  } catch (e) {
    // Backend refuses to remove the last active staff — show that message.
    error.value = e instanceof Error ? e.message : 'Не удалось снять доступ';
  } finally {
    rowBusy.value = null;
  }
}

async function submitNew() {
  formError.value = '';
  formSuccess.value = '';
  const email = newEmail.value.trim();
  if (!email) {
    formError.value = 'Введите email';
    return;
  }
  if (newPassword.value.length < 8) {
    formError.value = 'Пароль должен быть не короче 8 символов';
    return;
  }
  creating.value = true;
  try {
    const phone = newPhone.value.trim();
    await createStaff({
      email,
      password: newPassword.value,
      phone: phone || null,
    });
    formSuccess.value = 'Сотрудник добавлен';
    newEmail.value = '';
    newPassword.value = '';
    newPhone.value = '';
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Не удалось создать';
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Staff table -->
    <div
      v-if="loading"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
    >
      Загрузка…
    </div>

    <div
      v-else-if="error && items.length === 0"
      class="rounded-2xl border-2 border-fill bg-white p-6 text-danger"
    >
      {{ error }}
    </div>

    <div
      v-else-if="isEmpty"
      class="rounded-2xl border-2 border-fill bg-white p-10 text-center text-subtle"
    >
      Сотрудников нет
    </div>

    <div v-else class="space-y-3">
      <!-- Action-level error banner (e.g. last-active-staff refusal). -->
      <div
        v-if="error"
        class="rounded-xl border-2 border-danger bg-white p-3 text-sm text-danger"
      >
        {{ error }}
      </div>

      <div class="overflow-hidden rounded-2xl border-2 border-fill bg-white">
        <table class="w-full text-sm">
          <thead class="border-b-2 border-fill text-left text-subtle">
            <tr>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Телефон</th>
              <th class="px-4 py-3 font-medium">Статус</th>
              <th class="px-4 py-3 font-medium">Добавлен</th>
              <th class="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in items"
              :key="row.id"
              class="border-b border-fill last:border-0"
            >
              <td class="px-4 py-3 text-ink">{{ row.email }}</td>
              <td class="px-4 py-3 text-body">{{ row.phone || '—' }}</td>
              <td class="px-4 py-3">
                <span
                  v-if="row.is_active"
                  class="rounded-lg bg-fill px-2 py-0.5 text-xs font-medium text-body"
                >
                  Активен
                </span>
                <span
                  v-else
                  class="rounded-lg bg-badge-sale-bg px-2 py-0.5 text-xs font-medium text-badge-sale"
                >
                  Заблокирован
                </span>
              </td>
              <td class="px-4 py-3 text-subtle">
                {{ formatDate(row.created_at) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    type="button"
                    :disabled="rowBusy === row.id"
                    class="rounded-lg border-2 border-fill px-2.5 py-1 text-xs font-medium text-body hover:bg-fill disabled:opacity-50"
                    @click="toggleActive(row)"
                  >
                    {{ row.is_active ? 'Заблокировать' : 'Активировать' }}
                  </button>
                  <button
                    type="button"
                    :disabled="rowBusy === row.id"
                    class="rounded-lg border-2 border-danger px-2.5 py-1 text-xs font-medium text-danger hover:bg-fill disabled:opacity-50"
                    @click="revokeAccess(row)"
                  >
                    Снять доступ
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add-staff form -->
    <form
      class="rounded-2xl border-2 border-fill bg-white p-6"
      @submit.prevent="submitNew"
    >
      <h2 class="text-lg font-bold text-ink">Добавить сотрудника</h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-sm font-medium text-body">Email</label>
          <input
            v-model="newEmail"
            type="email"
            autocomplete="off"
            class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-body">Пароль</label>
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
          />
          <p class="mt-1 text-xs text-subtle">Минимум 8 символов.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-body">
            Телефон
            <span class="text-subtle">(необязательно)</span>
          </label>
          <input
            v-model="newPhone"
            type="tel"
            autocomplete="off"
            class="mt-1 w-full rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
          />
        </div>
      </div>

      <p v-if="formError" class="mt-3 text-sm text-danger">{{ formError }}</p>
      <p v-if="formSuccess" class="mt-3 text-sm text-primary">
        {{ formSuccess }}
      </p>

      <button
        type="submit"
        :disabled="creating"
        class="mt-4 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {{ creating ? 'Добавление…' : 'Добавить сотрудника' }}
      </button>
    </form>
  </div>
</template>
