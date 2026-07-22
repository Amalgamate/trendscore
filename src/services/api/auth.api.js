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

  logout: async () => {
    const response = await axiosInstance.post('/auth/logout');
    return response.data;
  },

  getSeededUsers: async () => {
    try {
      const response = await axiosInstance.get('/auth/seeded-users');
      return response.data;
    } catch {
      return { users: [] };
    }
  },

  resetPassword: async (token, newPassword, passwordConfirm) =>
    fetchWithAuth('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, passwordConfirm: passwordConfirm ?? newPassword }),
    }),

  /** Send a password-reset email to the given address (unauthenticated — no session required). */
  forgotPassword: async (email) => {
    const response = await axiosInstance.post('/auth/forgot-password', { email });
    return response.data;
  },

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

  requestPhoneOtp: async (data) => {
    try {
      const response = await axiosInstance.post('/auth/phone-otp/request', data);
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  getLoginConfig: async () => {
    try {
      const response = await axiosInstance.get('/auth/login-config');
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  verifyPhoneOtp: async (data) => {
    try {
      const response = await axiosInstance.post('/auth/phone-otp/verify', data);
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  studentPhoneLookup: async ({ phone }) => {
    try {
      const response = await axiosInstance.post('/auth/student-phone/lookup', { phone });
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(extractApiErrorMessage(error.response.data, error.response.status));
      }
      throw error;
    }
  },

  studentPhoneLogin: async ({ sessionToken, studentUserId, password, rememberMe = false }) => {
    try {
      const response = await axiosInstance.post('/auth/student-phone/login', {
        sessionToken,
        studentUserId,
        password,
        rememberMe,
      });
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
