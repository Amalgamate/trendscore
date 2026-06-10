import { fetchWithAuth } from './core';

export const userAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/users${queryString ? `?${queryString}` : ''}`);
  },
  getById: async (id) => fetchWithAuth(`/users/${id}`),
  getByRole: async (role, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/users/role/${role}${queryString ? `?${queryString}` : ''}`);
  },
  getStats: async () => fetchWithAuth('/users/stats'),
  getVerificationSettings: async () => fetchWithAuth('/users/verification-settings'),
  updateVerificationSettings: async (data) =>
    fetchWithAuth('/users/verification-settings', { method: 'PUT', body: JSON.stringify(data) }),
  create: async (userData) =>
    fetchWithAuth('/users', { method: 'POST', body: JSON.stringify(userData) }),
  update: async (id, userData) =>
    fetchWithAuth(`/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }),
  updateVerificationRequired: async (id, verificationRequired) =>
    fetchWithAuth(`/users/${id}/verification-required`, {
      method: 'PUT',
      body: JSON.stringify({ verificationRequired }),
    }),
  archive: async (id) =>
    fetchWithAuth(`/users/${id}/archive`, { method: 'POST' }),
  unarchive: async (id) =>
    fetchWithAuth(`/users/${id}/unarchive`, { method: 'POST' }),
  delete: async (id) =>
    fetchWithAuth(`/users/${id}`, { method: 'DELETE' }),
  uploadPhoto: async (id, photoData) =>
    fetchWithAuth(`/users/${id}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photoData }),
    }),
  resetPassword: async (id, data) =>
    fetchWithAuth(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),
  sendCredentials: async (id) =>
    fetchWithAuth(`/users/${id}/credentials`, { method: 'POST' }),
  syncMissingStudentAccounts: async () =>
    fetchWithAuth('/bulk/learners/sync-student-users', { method: 'POST' }),
};
