import { fetchWithAuth } from './core';

const responseData = (response) => response?.data ?? response;

export const biometricAPI = {
  /**
   * Device Management
   */
  getDevices: async () => responseData(await fetchWithAuth('/biometric/devices')) || [],
  
  registerDevice: async (data) => responseData(await fetchWithAuth('/biometric/devices', {
    method: 'POST',
    body: JSON.stringify(data)
  })),
  
  updateDevice: async (id, data) => responseData(await fetchWithAuth(`/biometric/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })),
  
  decommissionDevice: async (id) => responseData(await fetchWithAuth(`/biometric/devices/${id}`, {
    method: 'DELETE'
  })),

  rotateDeviceToken: async (id) => responseData(await fetchWithAuth(`/biometric/devices/${id}/rotate-token`, {
    method: 'POST'
  })),

  createTerminalActivation: async (id) => responseData(await fetchWithAuth(`/biometric/devices/${id}/activation`, {
    method: 'POST'
  })),

  testDeviceConnection: async (id) => responseData(await fetchWithAuth(`/biometric/devices/${id}/test`, {
    method: 'POST'
  })),

  getConfiguration: async () => responseData(await fetchWithAuth('/biometric/configuration')),

  /**
   * Enrollment
   */
  getEnrollmentStatus: async (type, id) => responseData(await fetchWithAuth(`/biometric/enroll/${type}/${id}`)),

  createFaceEnrollmentSession: async (personType, personId, consentConfirmed) => responseData(await fetchWithAuth('/biometric/face/enrollment/session', {
    method: 'POST',
    body: JSON.stringify({ personType, personId, consentConfirmed })
  })),

  completeFaceEnrollmentSession: async (sessionId) => responseData(await fetchWithAuth(`/biometric/face/enrollment/session/${sessionId}/complete`, {
    method: 'POST'
  })),

  revokeCredential: async (credentialId) => responseData(await fetchWithAuth(`/biometric/credentials/${credentialId}`, {
    method: 'DELETE'
  })),
  
  enrollFingerprint: async (data) => responseData(await fetchWithAuth('/biometric/enroll', {
    method: 'POST',
    body: JSON.stringify(data)
  })),

  /**
   * Attendance Logs
   */
  getLogs: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetchWithAuth(`/biometric/logs${queryString ? `?${queryString}` : ''}`);
    return { logs: response?.data || [], total: response?.count || 0 };
  },
  
  processLog: async (logId) => responseData(await fetchWithAuth(`/biometric/logs/${logId}/process`, {
    method: 'POST'
  })),
};

export default biometricAPI;
