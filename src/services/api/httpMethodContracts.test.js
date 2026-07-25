import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingAPI } from './accounting.api';
import { fetchWithAuth } from './core';
import { userAPI } from './user.api';

vi.mock('./core', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('HTTP method contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives users with POST', async () => {
    await userAPI.archive('user-1');

    expect(fetchWithAuth).toHaveBeenCalledWith('/users/user-1/archive', { method: 'POST' });
  });

  it('posts journal entries to the ledger with PUT', async () => {
    await accountingAPI.postJournalEntry('entry-1');

    expect(fetchWithAuth).toHaveBeenCalledWith('/accounting/entries/entry-1/post', { method: 'PUT' });
  });
});
