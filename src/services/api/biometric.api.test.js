import { beforeEach, describe, expect, it, vi } from 'vitest';
import { biometricAPI } from './biometric.api';
import { fetchWithAuth } from './core';

vi.mock('./core', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('biometric API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps the school-scoped terminal list', async () => {
    fetchWithAuth.mockResolvedValueOnce({ success: true, data: [{ id: 'device-1' }], count: 1 });

    await expect(biometricAPI.getDevices()).resolves.toEqual([{ id: 'device-1' }]);
    expect(fetchWithAuth).toHaveBeenCalledWith('/biometric/devices');
  });

  it('updates devices with PATCH', async () => {
    fetchWithAuth.mockResolvedValueOnce({ success: true, data: { id: 'device-1' } });

    await biometricAPI.updateDevice('device-1', { name: 'Main gate' });

    expect(fetchWithAuth).toHaveBeenCalledWith('/biometric/devices/device-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Main gate' }),
    });
  });

  it('uses explicit lifecycle endpoints for test, rotation, and decommission', async () => {
    fetchWithAuth.mockResolvedValue({ success: true, data: {} });

    await biometricAPI.testDeviceConnection('device-1');
    await biometricAPI.rotateDeviceToken('device-1');
    await biometricAPI.decommissionDevice('device-1');

    expect(fetchWithAuth).toHaveBeenNthCalledWith(1, '/biometric/devices/device-1/test', { method: 'POST' });
    expect(fetchWithAuth).toHaveBeenNthCalledWith(2, '/biometric/devices/device-1/rotate-token', { method: 'POST' });
    expect(fetchWithAuth).toHaveBeenNthCalledWith(3, '/biometric/devices/device-1', { method: 'DELETE' });
  });

  it('normalizes log responses for the log viewer', async () => {
    fetchWithAuth.mockResolvedValueOnce({ success: true, data: [{ id: 'log-1' }], count: 1 });

    await expect(biometricAPI.getLogs({ status: 'FAILED' })).resolves.toEqual({
      logs: [{ id: 'log-1' }],
      total: 1,
    });
    expect(fetchWithAuth).toHaveBeenCalledWith('/biometric/logs?status=FAILED');
  });
});
