import { fetchWithAuth } from './core';

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

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
  getAssessmentOperations: async (filters = {}) =>
    fetchWithAuth(`/dashboard/assessment-operations${buildQuery(filters)}`),
  getAcademicIntelligence: async (filters = {}) =>
    fetchWithAuth(`/dashboard/academic-intelligence${buildQuery(filters)}`),
};
