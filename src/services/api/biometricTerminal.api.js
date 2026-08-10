import { API_BASE_URL } from './axiosConfig';

const terminalRequest = async (path, { token, body } = {}) => {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    });
  } catch (error) {
    const networkError = new Error('Network unavailable');
    networkError.cause = error;
    networkError.networkError = true;
    throw networkError;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Terminal request failed (${response.status})`);
    error.status = response.status;
    error.networkError = response.status >= 500 || payload.offline === true;
    throw error;
  }
  return payload.data;
};

export const biometricTerminalAPI = {
  activate: (deviceId, activationCode) => terminalRequest('/biometric/terminal/activate', {
    body: { deviceId, activationCode },
  }),
  recordEvent: (token, event) => terminalRequest('/biometric/terminal/events', {
    token,
    body: event,
  }),
  createFaceSession: (token, deviceId, direction) => terminalRequest('/biometric/terminal/face/session', {
    token,
    body: { deviceId, direction },
  }),
  completeFaceSession: (token, deviceId, sessionId) => terminalRequest(`/biometric/terminal/face/session/${sessionId}/complete`, {
    token,
    body: { deviceId },
  }),
};

export default biometricTerminalAPI;
