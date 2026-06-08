import { fetchWithAuth } from './core';
import axiosInstance from './axiosConfig';

function extractApiErrorMessage(data, status = 500) {
  if (!data) return `HTTP ${status}`;
  let msg = data.message ?? data.error;
  if (msg && typeof msg === 'object') {
    msg = msg.message ?? msg.error ?? JSON.stringify(msg);
  }
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return `HTTP ${status}`;
}

export const authAPI = {
  login: async (credentials) => {
    try {
      const response = await axiosInstance.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  schoolPublic: async () => {
    const response = await axiosInstance.get('/schools/public/branding');
    return response.data;
  },

  register: async (userData) => {
    const response = await axiosInstance.post('/auth/register', userData);
    return response.data;
  },

  checkAvailability: async (data) => {
    const response = await axiosInstance.post('/auth/check-availability', data);
    return response.data;
  },

  me: async () => fetchWithAuth('/auth/me'),

  getSeededUsers: async () => {
    try {
      const response = await axiosInstance.get('/auth/seeded-users');
      return response.data;
    } catch {
      return { users: [] };
    }
  },

  resetPassword: async (token, password) =>
    fetchWithAuth('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  sendOTP: async (data) => {
    try {
      const response = await axiosInstance.post('/auth/otp/send', data);
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  verifyOTP: async (data) => {
    try {
      const response = await axiosInstance.post('/auth/otp/verify', data);
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  getCsrf: async () => {
    const response = await axiosInstance.get('/auth/csrf');
    return response.data;
  },

  /** Force-logout all active sessions. ADMIN / SUPER_ADMIN only. */
  logoutAll: async () => {
    const response = await axiosInstance.post('/auth/logout-all');
    return response.data;
  },

  /** Flush the server-side Redis cache. ADMIN / SUPER_ADMIN only. */
  flushCache: async () => {
    const response = await axiosInstance.post('/auth/flush-cache');
    return response.data;
  },
};
