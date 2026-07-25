import { fetchWithAuth } from './core';

export const accountingAPI = {
  initializeCoA: async () =>
    fetchWithAuth('/accounting/initialize', { method: 'POST', body: JSON.stringify({}) }),
  getAccounts: async (includeBalances = false) => fetchWithAuth(`/accounting/accounts${includeBalances ? '?balances=true' : ''}`),
  createAccount: async (data) =>
    fetchWithAuth('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) }),
  getBalances: async () => fetchWithAuth('/accounting/balances'),
  getJournals: async () => fetchWithAuth('/accounting/journals'),
  getJournalEntries: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchWithAuth(`/accounting/entries${params ? '?' + params : ''}`);
  },
  createJournalEntry: async (data) =>
    fetchWithAuth('/accounting/entries', { method: 'POST', body: JSON.stringify(data) }),
  postJournalEntry: async (id) =>
    fetchWithAuth(`/accounting/entries/${id}/post`, { method: 'PUT' }),
  getVendors: async () => fetchWithAuth('/accounting/vendors'),
  createVendor: async (data) =>
    fetchWithAuth('/accounting/vendors', { method: 'POST', body: JSON.stringify(data) }),
  getExpenses: async () => fetchWithAuth('/accounting/expenses'),
  recordExpense: async (data) =>
    fetchWithAuth('/accounting/expenses', { method: 'POST', body: JSON.stringify(data) }),
  getBankStatements: async (accountId) => fetchWithAuth(`/accounting/bank-statements${accountId ? `?accountId=${accountId}` : ''}`),
  importBankStatement: async (data) =>
    fetchWithAuth('/accounting/bank-statements/import', { method: 'POST', body: JSON.stringify(data) }),
  reconcileLine: async (data) =>
    fetchWithAuth('/accounting/bank-statements/reconcile', { method: 'POST', body: JSON.stringify(data) }),
  getSuggestedMatches: async (lineId) => fetchWithAuth(`/accounting/bank-statements/${lineId}/suggest-matches`),
  getReport: async (type, startDate, endDate) =>
    fetchWithAuth(`/accounting/reports?type=${type}&startDate=${startDate}&endDate=${endDate}`),
  getTrialBalance: async (startDate, endDate) =>
    fetchWithAuth(`/accounting/reports/trial-balance?startDate=${startDate}&endDate=${endDate}`),
  getDashboardStats: async () => fetchWithAuth('/accounting/dashboard-stats'),
};
