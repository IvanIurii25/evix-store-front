import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import SupportInbox from './SupportInbox.vue';
import {
  listConversations,
  getThread,
  replyToConversation,
  setConversationStatus,
  subscribeSupport,
  type ConversationOut,
  type MessageOut,
  type SupportEvent,
} from '../../api/support';

vi.mock('../../api/support', () => ({
  listConversations: vi.fn(),
  getThread: vi.fn(),
  replyToConversation: vi.fn(),
  setConversationStatus: vi.fn(),
  subscribeSupport: vi.fn(),
}));

const mockList = vi.mocked(listConversations);
const mockThread = vi.mocked(getThread);
const mockReply = vi.mocked(replyToConversation);
const mockStatus = vi.mocked(setConversationStatus);
const mockSubscribe = vi.mocked(subscribeSupport);

const conv = (over: Partial<ConversationOut> = {}): ConversationOut =>
  ({
    id: 1,
    customer_name: 'Ион',
    customer_username: 'ion',
    lang: 'ru',
    status: 'open',
    unread_count: 2,
    last_message_at: '2026-01-15T10:00:00Z',
    created_at: '2026-01-15T09:00:00Z',
    ...over,
  }) as ConversationOut;

const msg = (over: Partial<MessageOut> = {}): MessageOut =>
  ({
    id: 1,
    direction: 'in',
    text: 'Здравствуйте',
    delivery: null,
    sender_staff_id: null,
    created_at: '2026-01-15T10:00:00Z',
    ...over,
  }) as MessageOut;

const listOf = (data: ConversationOut[]) => ({
  data,
  total: data.length,
  page: 1,
  page_size: 20,
});
const threadOf = (conversation: ConversationOut, data: MessageOut[]) => ({
  conversation,
  data,
  total: data.length,
  page: 1,
  page_size: 50,
});

let sseCallback: (e: SupportEvent) => void = () => {};
const fakeSource = { close: vi.fn() } as unknown as EventSource;

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribe.mockImplementation((cb) => {
    sseCallback = cb;
    return fakeSource;
  });
});

describe('SupportInbox', () => {
  it('shows a loading state before the first list resolves', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);
    const w = mount(SupportInbox);
    expect(w.text()).toContain('Загрузка');
  });

  it('renders a conversation row with unread badge and empty thread pane', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    const w = mount(SupportInbox);
    await flushPromises();

    expect(mockList).toHaveBeenCalledWith({ status: null, page: 1 });
    const items = w.findAll('li');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain('Ион');
    expect(items[0].text()).toContain('2'); // unread badge
    expect(w.text()).toContain('Выберите диалог'); // no thread selected yet
  });

  it('shows the empty state when there are no conversations', async () => {
    mockList.mockResolvedValue(listOf([]));
    const w = mount(SupportInbox);
    await flushPromises();
    expect(w.text()).toContain('Диалогов нет');
  });

  it('surfaces a list error', async () => {
    mockList.mockRejectedValue(new Error('нет доступа'));
    const w = mount(SupportInbox);
    await flushPromises();
    expect(w.text()).toContain('нет доступа');
  });

  it('opens a conversation, renders the thread and clears unread locally', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(
      threadOf(conv({ unread_count: 0 }), [
        msg({ id: 1, direction: 'in', text: 'Вопрос' }),
        msg({ id: 2, direction: 'out', text: 'Ответ' }),
      ]),
    );
    const w = mount(SupportInbox);
    await flushPromises();

    await w.find('li').trigger('click');
    await flushPromises();

    expect(mockThread).toHaveBeenCalledWith(1);
    expect(w.text()).toContain('Вопрос');
    expect(w.text()).toContain('Ответ');
    // unread badge gone after opening
    expect(w.find('li').text()).not.toMatch(/\b2\b/);
  });

  it('sends a reply, appends it and refetches the list', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(threadOf(conv(), [msg()]));
    mockReply.mockResolvedValue(
      msg({ id: 50, direction: 'out', text: 'Готово', delivery: 'sent' }),
    );
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();

    await w.find('textarea').setValue('Готово');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Отправить')!
      .trigger('click');
    await flushPromises();

    expect(mockReply).toHaveBeenCalledWith(1, 'Готово');
    expect(w.text()).toContain('Готово');
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('');
    // loadList called on mount + after send
    expect(mockList.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not send an empty reply', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(threadOf(conv(), [msg()]));
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();

    await w.find('textarea').setValue('   ');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Отправить')!
      .trigger('click');
    await flushPromises();
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('changes the conversation status', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(threadOf(conv(), [msg()]));
    mockStatus.mockResolvedValue(conv({ status: 'closed' }));
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();

    // header status buttons: pick "Закрыт"
    const closeBtn = w.findAll('button').find((b) => b.text() === 'Закрыт');
    await closeBtn!.trigger('click');
    await flushPromises();
    expect(mockStatus).toHaveBeenCalledWith(1, 'closed');
  });

  it('reloads the list on an SSE event and refetches the open thread on inbound', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(threadOf(conv(), [msg()]));
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();

    const listCallsBefore = mockList.mock.calls.length;
    const threadCallsBefore = mockThread.mock.calls.length;
    sseCallback({ conversation_id: 1, kind: 'inbound' });
    await flushPromises();

    expect(mockList.mock.calls.length).toBe(listCallsBefore + 1);
    expect(mockThread.mock.calls.length).toBe(threadCallsBefore + 1);
  });

  it('closes the SSE source on unmount', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    const w = mount(SupportInbox);
    await flushPromises();
    w.unmount();
    expect(fakeSource.close).toHaveBeenCalled();
  });

  it('surfaces a thread-load error when opening fails', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockRejectedValue(new Error('тред упал'));
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('тред упал');
  });

  it('surfaces a reply error and keeps the text', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(threadOf(conv(), [msg()]));
    mockReply.mockRejectedValue(new Error('не ушло'));
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();

    await w.find('textarea').setValue('Привет');
    // Enter (without shift) sends too — exercises the keydown handler.
    await w.find('textarea').trigger('keydown.enter.exact');
    await flushPromises();
    expect(mockReply).toHaveBeenCalledWith(1, 'Привет');
    expect(w.text()).toContain('не ушло');
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe(
      'Привет',
    );
  });

  it('surfaces a status-change error', async () => {
    mockList.mockResolvedValue(listOf([conv()]));
    mockThread.mockResolvedValue(threadOf(conv(), [msg()]));
    mockStatus.mockRejectedValue(new Error('статус не сменился'));
    const w = mount(SupportInbox);
    await flushPromises();
    await w.find('li').trigger('click');
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Закрыт')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('статус не сменился');
  });

  it('falls back to a generic name and shows a failed-delivery badge', async () => {
    mockList.mockResolvedValue(
      listOf([conv({ customer_name: null, customer_username: null })]),
    );
    mockThread.mockResolvedValue(
      threadOf(conv({ customer_name: null, customer_username: null }), [
        msg({ id: 9, direction: 'out', text: 'сбой', delivery: 'failed' }),
      ]),
    );
    const w = mount(SupportInbox);
    await flushPromises();
    expect(w.find('li').text()).toContain('Диалог #1');
    await w.find('li').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('не доставлено');
  });
});
