<script setup lang="ts">
import { computed, onMounted, onUnmounted, nextTick, ref, watch } from 'vue';

import {
  listConversations,
  getThread,
  replyToConversation,
  setConversationStatus,
  deleteConversation,
  subscribeSupport,
  listCanned,
  linkOrder,
  unlinkOrder,
  attachmentUrl,
  type ConversationOut,
  type MessageOut,
  type CannedOut,
  type LinkedOrderOut,
} from '../../api/support';

// --------------------------------------------------------------------------- //
// Status → Russian label + badge palette
// --------------------------------------------------------------------------- //
const STATUS_LABELS: Record<string, string> = {
  open: 'Открыт',
  pending: 'Ждёт',
  closed: 'Закрыт',
};
function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

const BADGE_BASE = 'rounded-full px-2 py-0.5 text-xs font-medium';
function statusBadge(s: string): string {
  switch (s) {
    case 'open':
      return `${BADGE_BASE} bg-primary/10 text-primary`;
    case 'pending':
      return `${BADGE_BASE} bg-badge-sale-bg text-badge-sale`;
    case 'closed':
      return `${BADGE_BASE} bg-fill text-subtle`;
    default:
      return `${BADGE_BASE} bg-fill text-body`;
  }
}

const STATUS_ACTIONS = ['open', 'pending', 'closed'];

// --------------------------------------------------------------------------- //
// State — conversation list (left pane)
// --------------------------------------------------------------------------- //
const conversations = ref<ConversationOut[]>([]);
const listLoading = ref(true);
const listError = ref('');
const statusFilter = ref('');

// State — open thread (right pane)
const selectedId = ref<number | null>(null);
const threadConv = ref<ConversationOut | null>(null);
const messages = ref<MessageOut[]>([]);
const threadLoading = ref(false);
const threadError = ref('');

// Reply box
const replyText = ref('');
const sending = ref(false);
const replyError = ref('');

// Erasure confirm toggle (reset whenever a conversation is opened)
const confirmingDelete = ref(false);

// Linked order (operator context)
const linkedOrder = ref<LinkedOrderOut | null>(null);
const orderInput = ref('');
const linking = ref(false);

// Canned responses (reply templates) — loaded once, filtered by the open
// conversation's language for the picker.
const canned = ref<CannedOut[]>([]);
const showCanned = ref(false);
const cannedForLang = computed(() => {
  const lang = threadConv.value?.lang;
  const matches = lang ? canned.value.filter((c) => c.lang === lang) : [];
  return matches.length ? matches : canned.value;
});
function insertCanned(text: string) {
  replyText.value = replyText.value ? `${replyText.value}\n${text}` : text;
  showCanned.value = false;
}

const threadEl = ref<HTMLElement | null>(null);

// --------------------------------------------------------------------------- //
// Loads
// --------------------------------------------------------------------------- //
async function loadList() {
  listLoading.value = true;
  listError.value = '';
  try {
    const res = await listConversations({
      status: statusFilter.value || null,
      page: 1,
    });
    conversations.value = res.data;
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    listLoading.value = false;
  }
}

async function openConversation(id: number) {
  selectedId.value = id;
  threadLoading.value = true;
  threadError.value = '';
  replyError.value = '';
  confirmingDelete.value = false;
  try {
    const res = await getThread(id);
    threadConv.value = res.conversation;
    messages.value = res.data;
    linkedOrder.value = res.linked_order ?? null;
    orderInput.value = '';
    // Opening clears unread on the server (mark_read) — reflect it locally.
    const row = conversations.value.find((c) => c.id === id);
    if (row) row.unread_count = 0;
    await scrollThreadToEnd();
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    threadLoading.value = false;
  }
}

async function send() {
  const text = replyText.value.trim();
  if (!text || sending.value || selectedId.value === null) return;
  sending.value = true;
  replyError.value = '';
  try {
    const msg = await replyToConversation(selectedId.value, text);
    messages.value.push(msg);
    replyText.value = '';
    await scrollThreadToEnd();
    await loadList(); // bump this conversation to the top
  } catch (e) {
    replyError.value = e instanceof Error ? e.message : 'Не удалось отправить';
  } finally {
    sending.value = false;
  }
}

async function changeStatus(status: string) {
  if (selectedId.value === null) return;
  try {
    const conv = await setConversationStatus(selectedId.value, status);
    threadConv.value = conv;
    const row = conversations.value.find((c) => c.id === conv.id);
    if (row) row.status = conv.status;
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Не удалось изменить';
  }
}

// On-request erasure (LP195 Art.17): two-step confirm, then hard-delete and drop
// the conversation from the list / clear the pane.
async function removeConversation() {
  const id = selectedId.value;
  if (id === null) return;
  try {
    await deleteConversation(id);
    conversations.value = conversations.value.filter((c) => c.id !== id);
    selectedId.value = null;
    threadConv.value = null;
    messages.value = [];
    confirmingDelete.value = false;
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Не удалось удалить';
  }
}

async function linkToOrder() {
  const num = orderInput.value.trim();
  if (!num || selectedId.value === null || linking.value) return;
  linking.value = true;
  threadError.value = '';
  try {
    linkedOrder.value = await linkOrder(selectedId.value, num);
    orderInput.value = '';
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Заказ не найден';
  } finally {
    linking.value = false;
  }
}

async function unlinkFromOrder() {
  if (selectedId.value === null) return;
  try {
    await unlinkOrder(selectedId.value);
    linkedOrder.value = null;
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Не удалось отвязать';
  }
}

async function scrollThreadToEnd() {
  await nextTick();
  const el = threadEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

// --------------------------------------------------------------------------- //
// Live feed (SSE) — refetch the list on any event; refetch the open thread when
// a new inbound message lands in it.
// --------------------------------------------------------------------------- //
let source: EventSource | null = null;

onMounted(() => {
  loadList();
  listCanned()
    .then((rows) => (canned.value = rows))
    .catch(() => {});
  source = subscribeSupport((evt) => {
    loadList();
    if (evt.conversation_id === selectedId.value && evt.kind === 'inbound') {
      openConversation(evt.conversation_id);
    }
  });
});

onUnmounted(() => {
  source?.close();
});

watch(statusFilter, loadList);

// --------------------------------------------------------------------------- //
// Formatting
// --------------------------------------------------------------------------- //
function formatTime(x: string): string {
  return new Date(x).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function displayName(c: ConversationOut): string {
  return c.customer_name || c.customer_username || `Диалог #${c.id}`;
}

const listEmpty = computed(
  () =>
    !listLoading.value && !listError.value && conversations.value.length === 0,
);
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <!-- Left: conversation list -->
    <div class="flex flex-col gap-3 md:col-span-1">
      <div class="flex flex-wrap gap-3">
        <a
          href="/admin/support/templates"
          class="text-sm text-subtle hover:text-primary"
        >
          Шаблоны ответов →
        </a>
        <a
          href="/admin/support/metrics"
          class="text-sm text-subtle hover:text-primary"
        >
          Метрики →
        </a>
      </div>
      <select
        v-model="statusFilter"
        class="rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
      >
        <option value="">Все статусы</option>
        <option value="open">Открытые</option>
        <option value="pending">Ждут</option>
        <option value="closed">Закрытые</option>
      </select>

      <div
        v-if="listLoading"
        class="rounded-2xl border-2 border-fill bg-white p-6 text-subtle"
      >
        Загрузка…
      </div>
      <div
        v-else-if="listError"
        class="rounded-2xl border-2 border-fill bg-white p-6 text-danger"
      >
        {{ listError }}
      </div>
      <div
        v-else-if="listEmpty"
        class="rounded-2xl border-2 border-fill bg-white p-10 text-center text-subtle"
      >
        Диалогов нет
      </div>

      <ul
        v-else
        class="max-h-[70vh] divide-y divide-fill overflow-y-auto rounded-2xl border-2 border-fill bg-white"
      >
        <li
          v-for="c in conversations"
          :key="c.id"
          class="cursor-pointer px-4 py-3 hover:bg-fill"
          :class="c.id === selectedId ? 'bg-fill' : ''"
          @click="openConversation(c.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate font-medium text-ink">{{
              displayName(c)
            }}</span>
            <span
              v-if="c.unread_count > 0"
              class="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white"
            >
              {{ c.unread_count }}
            </span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-2">
            <span :class="statusBadge(c.status)">{{
              statusLabel(c.status)
            }}</span>
            <span class="text-xs text-subtle">{{
              formatTime(c.last_message_at)
            }}</span>
          </div>
        </li>
      </ul>
    </div>

    <!-- Right: thread -->
    <div class="flex flex-col md:col-span-2">
      <div
        v-if="selectedId === null"
        class="flex flex-1 items-center justify-center rounded-2xl border-2 border-fill bg-white p-10 text-subtle"
      >
        Выберите диалог слева
      </div>

      <div
        v-else
        class="flex h-[75vh] flex-col rounded-2xl border-2 border-fill bg-white"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between gap-3 border-b-2 border-fill px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-ink">
              {{ threadConv ? displayName(threadConv) : '' }}
            </p>
            <p v-if="threadConv?.customer_username" class="text-xs text-subtle">
              @{{ threadConv.customer_username }}
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-for="s in STATUS_ACTIONS"
              :key="s"
              class="rounded-lg px-2 py-1 text-xs font-medium"
              :class="
                threadConv?.status === s
                  ? 'bg-primary text-white'
                  : 'bg-fill text-subtle hover:text-ink'
              "
              @click="changeStatus(s)"
            >
              {{ statusLabel(s) }}
            </button>

            <!-- Erasure: two-step confirm -->
            <template v-if="!confirmingDelete">
              <button
                class="ml-2 rounded-lg bg-fill px-2 py-1 text-xs font-medium text-subtle hover:text-danger"
                @click="confirmingDelete = true"
              >
                Удалить
              </button>
            </template>
            <template v-else>
              <span class="ml-2 text-xs text-subtle">Удалить?</span>
              <button
                class="rounded-lg bg-danger px-2 py-1 text-xs font-medium text-white"
                @click="removeConversation"
              >
                Да
              </button>
              <button
                class="rounded-lg bg-fill px-2 py-1 text-xs font-medium text-subtle"
                @click="confirmingDelete = false"
              >
                Нет
              </button>
            </template>
          </div>
        </div>

        <!-- Linked-order context bar -->
        <div
          class="flex items-center gap-2 border-b-2 border-fill bg-fill/40 px-4 py-2 text-sm"
        >
          <template v-if="linkedOrder">
            <span class="text-subtle">Заказ</span>
            <a
              :href="`/admin/orders/${linkedOrder.number}`"
              class="font-mono font-medium text-primary hover:underline"
            >
              {{ linkedOrder.number }}
            </a>
            <span class="text-subtle"
              >· {{ linkedOrder.status }} ·
              {{ Number(linkedOrder.total).toLocaleString('ru-RU') }} L</span
            >
            <button
              class="ml-auto text-xs text-subtle hover:text-danger"
              @click="unlinkFromOrder"
            >
              Отвязать
            </button>
          </template>
          <template v-else>
            <input
              v-model="orderInput"
              placeholder="Номер заказа…"
              class="w-48 rounded-lg border-2 border-fill px-2 py-1 text-sm outline-none focus:border-primary"
              @keydown.enter.prevent="linkToOrder"
            />
            <button
              class="rounded-lg bg-fill px-2 py-1 text-xs font-medium text-subtle hover:text-ink disabled:opacity-50"
              :disabled="linking || !orderInput.trim()"
              @click="linkToOrder"
            >
              Привязать заказ
            </button>
          </template>
        </div>

        <!-- Messages -->
        <div ref="threadEl" class="flex-1 space-y-3 overflow-y-auto p-4">
          <div v-if="threadLoading" class="text-subtle">Загрузка…</div>
          <div v-else-if="threadError" class="text-danger">
            {{ threadError }}
          </div>
          <template v-else>
            <div
              v-for="m in messages"
              :key="m.id"
              class="flex"
              :class="m.direction === 'out' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                :class="
                  m.direction === 'out'
                    ? 'bg-primary/10 text-ink'
                    : 'bg-fill text-body'
                "
              >
                <p class="whitespace-pre-wrap break-words">{{ m.text }}</p>

                <!-- Attachment (customer photo/document via staff proxy) -->
                <template v-if="m.attachment_kind && selectedId !== null">
                  <a
                    v-if="m.attachment_ready && m.attachment_kind === 'photo'"
                    :href="attachmentUrl(selectedId, m.id)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      :src="attachmentUrl(selectedId, m.id)"
                      crossorigin="use-credentials"
                      alt="фото"
                      class="mt-2 max-h-56 rounded-xl border border-fill"
                    />
                  </a>
                  <a
                    v-else-if="m.attachment_ready"
                    :href="attachmentUrl(selectedId, m.id)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-2 inline-block text-primary underline"
                  >
                    📎 Открыть вложение
                  </a>
                  <span v-else class="mt-2 block text-[11px] text-subtle"
                    >📎 загружается…</span
                  >
                </template>

                <div
                  class="mt-1 flex items-center gap-2 text-[11px] text-subtle"
                >
                  <span>{{ formatTime(m.created_at) }}</span>
                  <span v-if="m.delivery === 'failed'" class="text-danger"
                    >не доставлено</span
                  >
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Reply box -->
        <div class="border-t-2 border-fill p-3">
          <p v-if="replyError" class="mb-2 text-sm text-danger">
            {{ replyError }}
          </p>

          <!-- Canned-response picker -->
          <div v-if="canned.length" class="relative mb-2">
            <button
              type="button"
              class="rounded-lg bg-fill px-2 py-1 text-xs font-medium text-subtle hover:text-ink"
              @click="showCanned = !showCanned"
            >
              Шаблоны ▾
            </button>
            <ul
              v-if="showCanned"
              class="absolute bottom-full z-10 mb-1 max-h-60 w-72 overflow-y-auto rounded-xl border-2 border-fill bg-white shadow-lg"
            >
              <li
                v-for="c in cannedForLang"
                :key="c.id"
                class="cursor-pointer px-3 py-2 hover:bg-fill"
                @click="insertCanned(c.text)"
              >
                <p class="text-sm font-medium text-ink">{{ c.title }}</p>
                <p class="truncate text-xs text-subtle">{{ c.text }}</p>
              </li>
            </ul>
          </div>

          <div class="flex items-end gap-2">
            <textarea
              v-model="replyText"
              rows="2"
              placeholder="Ответ клиенту…"
              class="flex-1 resize-none rounded-xl border-2 border-fill px-3 py-2 outline-none focus:border-primary"
              @keydown.enter.exact.prevent="send"
            ></textarea>
            <button
              class="rounded-xl bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
              :disabled="sending || !replyText.trim()"
              @click="send"
            >
              {{ sending ? '…' : 'Отправить' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
