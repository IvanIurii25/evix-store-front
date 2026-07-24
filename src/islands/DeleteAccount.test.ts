import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteAccount = vi.fn();
vi.mock('../api/account', () => ({
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));

import DeleteAccount from './DeleteAccount.vue';

let hrefStore = '';
beforeEach(() => {
  vi.clearAllMocks();
  hrefStore = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return hrefStore;
      },
      set href(v: string) {
        hrefStore = v;
      },
    },
  });
});

describe('DeleteAccount', () => {
  it('shows a single delete button before confirming', () => {
    const wrapper = mount(DeleteAccount, { props: { lang: 'ru' } });
    expect(wrapper.findAll('button')).toHaveLength(1);
    expect(wrapper.text()).toContain('Удалить аккаунт');
  });

  it('reveals the warning + confirm/cancel and cancels back', async () => {
    const wrapper = mount(DeleteAccount, { props: { lang: 'ru' } });
    await wrapper.find('button').trigger('click');

    expect(wrapper.text()).toContain('безвозвратно');
    expect(wrapper.findAll('button')).toHaveLength(2);

    await wrapper.findAll('button')[0].trigger('click'); // cancel
    expect(wrapper.findAll('button')).toHaveLength(1);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('confirming erases the account and redirects to the home', async () => {
    deleteAccount.mockResolvedValue(true);
    const wrapper = mount(DeleteAccount, { props: { lang: 'ru' } });
    await wrapper.find('button').trigger('click'); // reveal
    await wrapper.findAll('button')[1].trigger('click'); // confirm
    await flushPromises();

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(hrefStore).toBe('/ru');
  });

  it('stays put (no redirect) when erasure fails', async () => {
    deleteAccount.mockResolvedValue(false);
    const wrapper = mount(DeleteAccount, { props: { lang: 'ru' } });
    await wrapper.find('button').trigger('click');
    await wrapper.findAll('button')[1].trigger('click');
    await flushPromises();

    expect(hrefStore).toBe('');
    expect(wrapper.findAll('button')).toHaveLength(1);
  });
});
