import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { biometricTerminalAPI } from './biometricTerminal.api';

vi.mock('./axiosConfig', () => ({ API_BASE_URL: '/api' }));

describe('phone terminal API', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('exchanges an activation code without a portal session', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { deviceToken: 'terminal-token' } }),
    });

    await expect(biometricTerminalAPI.activate('PHONE-01', '12345678')).resolves.toEqual({
      deviceToken: 'terminal-token',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/biometric/terminal/activate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ deviceId: 'PHONE-01', activationCode: '12345678' }),
    }));
  });

  it('sends replay-safe events with the terminal bearer token', async () => {
    const event = { eventId: 'event-12345678', deviceId: 'PHONE-01', personId: 'ADM-1' };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { eventId: event.eventId, duplicate: false } }),
    });

    await biometricTerminalAPI.recordEvent('terminal-token', event);
    expect(fetchMock).toHaveBeenCalledWith('/api/biometric/terminal/events', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer terminal-token' }),
      body: JSON.stringify(event),
    }));
  });

  it('creates and completes an AWS face liveness session with the terminal bearer token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { sessionId: 'face-session-1' } }),
    });

    await biometricTerminalAPI.createFaceSession('terminal-token', 'PHONE-01', 'IN');
    await biometricTerminalAPI.completeFaceSession('terminal-token', 'PHONE-01', 'face-session-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/biometric/terminal/face/session', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer terminal-token' }),
      body: JSON.stringify({ deviceId: 'PHONE-01', direction: 'IN' }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/biometric/terminal/face/session/face-session-1/complete', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer terminal-token' }),
      body: JSON.stringify({ deviceId: 'PHONE-01' }),
    }));
  });

  it('marks unreachable requests as queueable network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(biometricTerminalAPI.recordEvent('token', { eventId: 'event-12345678' }))
      .rejects.toMatchObject({ networkError: true, message: 'Network unavailable' });
  });

  it('queues service-worker and server availability failures for retry', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Offline', offline: true }),
    });

    await expect(biometricTerminalAPI.recordEvent('token', { eventId: 'event-12345678' }))
      .rejects.toMatchObject({ networkError: true, status: 503, message: 'Offline' });
  });
});
