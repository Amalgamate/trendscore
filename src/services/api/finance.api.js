import { fetchWithAuth } from './core';

export const financeAPI = {
  listRefunds: async (params = {}) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))).toString();
    return fetchWithAuth(`/refunds${query ? `?${query}` : ''}`);
  },
  submitRefund: async (data) => fetchWithAuth('/refunds', { method: 'POST', body: JSON.stringify(data) }),
  approveRefund: async (id, data = {}) => fetchWithAuth(`/refunds/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  rejectRefund: async (id, reason) => fetchWithAuth(`/refunds/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getRefund: async (id) => fetchWithAuth(`/refunds/${id}`),
  getDashboardSummary: async (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const query = new URLSearchParams(cleaned).toString();
    return fetchWithAuth(`/finance/dashboard-summary${query ? `?${query}` : ''}`);
  },
};
