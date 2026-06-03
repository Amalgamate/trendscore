import { fetchWithAuth } from './core';
import axiosInstance from './axiosConfig';

export const dashboardAPI = {
  getSecondaryMetrics: async () =>
    fetchWithAuth('/dashboard/secondary'),
  getAdminMetrics: async (filter = 'today') =>
    fetchWithAuth(`/dashboard/admin?filter=${filter}`),
  getTeacherMetrics: async (filter = 'today') =>
    fetchWithAuth(`/dashboard/teacher?filter=${filter}`),
  getParentMetrics: async () =>
    fetchWithAuth('/dashboard/parent'),
  getAccountantMetrics: async (filter = 'term') =>
    fetchWithAuth(`/dashboard/admin?filter=${filter}`),
  getInsights: async (fresh = false) =>
    fetchWithAuth(`/dashboard/insights${fresh ? '?fresh=1' : ''}`),
};
