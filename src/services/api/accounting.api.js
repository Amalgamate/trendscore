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
  getReport: async (type, startDate, endDate) =>
    fetchWithAuth(`/accounting/reports?type=${type}&startDate=${startDate}&endDate=${endDate}`),
  getTrialBalance: async (startDate, endDate) =>
    fetchWithAuth(`/accounting/reports/trial-balance?startDate=${startDate}&endDate=${endDate}`),
  getDashboardStats: async () => fetchWithAuth('/accounting/dashboard-stats'),
};

// Bank statement imports and matching use the dedicated reconciliation API.
export const reconciliationAPI = {
  getStatements: async ({ page = 1, limit = 50 } = {}) =>
    fetchWithAuth('/reconciliation/statements?page=' + page + '&limit=' + limit),
  getStatement: async (statementId, filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchWithAuth('/reconciliation/statements/' + encodeURIComponent(statementId) + (params ? '?' + params : ''));
  },
  importCsv: async (file) => {
    const body = new FormData();
    body.append('file', file);
    return fetchWithAuth('/reconciliation/import', { method: 'POST', body });
  },
  getSuggestedMatches: async (lineId) =>
    fetchWithAuth('/reconciliation/lines/' + encodeURIComponent(lineId) + '/suggest-matches'),
  reconcileLine: async (lineId, data) =>
    fetchWithAuth('/reconciliation/lines/' + encodeURIComponent(lineId) + '/reconcile', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  undoReconciliation: async (lineId) =>
    fetchWithAuth('/reconciliation/lines/' + encodeURIComponent(lineId) + '/unreconcile', { method: 'POST' }),
};
