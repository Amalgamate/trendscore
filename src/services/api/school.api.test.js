import { beforeEach, describe, expect, it, vi } from 'vitest';
import { schoolAPI } from './school.api';
import { fetchWithAuth } from './core';

vi.mock('./core', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('schoolAPI single-tenant contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the current school without an ID-based route', async () => {
    const data = { name: 'Zawadi' };

    await schoolAPI.updateCurrent(data, 'token');

    expect(fetchWithAuth).toHaveBeenCalledWith('/schools', {
      method: 'PUT',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify(data),
    });
  });

  it('deactivates and deletes the current school through single-tenant routes', async () => {
    await schoolAPI.deactivateCurrent();
    await schoolAPI.deleteCurrent();

    expect(fetchWithAuth).toHaveBeenNthCalledWith(1, '/schools/deactivate', { method: 'POST' });
    expect(fetchWithAuth).toHaveBeenNthCalledWith(2, '/schools', { method: 'DELETE' });
  });

  it('provisions a school only through the dedicated provisioning route', async () => {
    const data = { name: 'New School' };

    await schoolAPI.provision(data);

    expect(fetchWithAuth).toHaveBeenCalledWith('/schools/provision', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('does not expose obsolete multi-school mutation methods', () => {
    expect(schoolAPI).not.toHaveProperty('create');
    expect(schoolAPI).not.toHaveProperty('update');
    expect(schoolAPI).not.toHaveProperty('deactivate');
    expect(schoolAPI).not.toHaveProperty('delete');
  });
});
