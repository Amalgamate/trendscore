import { fetchWithAuth } from './core';

export const financeAPI = {
  getDashboardSummary: async (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const query = new URLSearchParams(cleaned).toString();
    return fetchWithAuth(`/finance/dashboard-summary${query ? `?${query}` : ''}`);
  },
};
