import { fetchWithAuth, API_BASE_URL } from './core';
import axiosInstance from './axiosConfig';

export const feeAPI = {
  getAllFeeStructures: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/fees/structures${query ? `?${query}` : ''}`);
  },
  createFeeStructure: async (data) =>
    fetchWithAuth('/fees/structures', { method: 'POST', body: JSON.stringify(data) }),
  updateFeeStructure: async (id, data) =>
    fetchWithAuth(`/fees/structures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFeeStructure: async (id) =>
    fetchWithAuth(`/fees/structures/${id}`, { method: 'DELETE' }),
  getAllInvoices: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/fees/invoices${query ? `?${query}` : ''}`);
  },
  getInvoiceAggregates: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/fees/invoices/aggregates${query ? `?${query}` : ''}`);
  },
  getLearnerInvoices: async (learnerId) => fetchWithAuth(`/fees/invoices/learner/${learnerId}`),
  createInvoice: async (data) =>
    fetchWithAuth('/fees/invoices', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateInvoices: async (data) =>
    fetchWithAuth('/fees/invoices/bulk', { method: 'POST', body: JSON.stringify(data) }),
  cancelInvoice: async (id, data = {}) =>
    fetchWithAuth(`/fees/invoices/${id}/cancel`, { method: 'PATCH', body: JSON.stringify(data) }),
  recordPayment: async (data) =>
    fetchWithAuth('/fees/payments', { method: 'POST', body: JSON.stringify(data) }),
  reversePayment: async (id, data = {}) =>
    fetchWithAuth(`/fees/payments/${id}/reverse`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAllFeeTypes: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/fees/types${query ? `?${query}` : ''}`);
  },
  createFeeType: async (data) =>
    fetchWithAuth('/fees/types', { method: 'POST', body: JSON.stringify(data) }),
  updateFeeType: async (id, data) =>
    fetchWithAuth(`/fees/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFeeType: async (id) =>
    fetchWithAuth(`/fees/types/${id}`, { method: 'DELETE' }),
  seedDefaultFeeTypes: async () =>
    fetchWithAuth('/fees/types/seed/defaults', { method: 'POST' }),
  seedDefaultFeeStructures: async (academicYear) =>
    fetchWithAuth('/fees/types/seed/structures', {
      method: 'POST',
      body: JSON.stringify(academicYear ? { academicYear } : {}),
    }),
  getPaymentStats: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/fees/stats${query ? `?${query}` : ''}`);
  },
  exportInvoices: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No authentication token found');
    const response = await fetch(`${API_BASE_URL}/fees/invoices/export${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to export invoices');
    return response.blob();
  },
  resetInvoices: async ({ academicYear, term, confirmToken } = {}) =>
    fetchWithAuth('/fees/invoices/reset', {
      method: 'POST',
      body: JSON.stringify({ academicYear, term, confirmToken })
    }),
  sendReminder: async (id, data) =>
    fetchWithAuth(`/fees/invoices/${id}/remind`, { method: 'POST', body: JSON.stringify(data) }),
  bulkSendReminders: async (data) =>
    fetchWithAuth('/fees/invoices/remind/bulk', { method: 'POST', body: JSON.stringify(data) }),
  emailStatement: async (learnerId, data) =>
    fetchWithAuth(`/fees/invoices/learner/${learnerId}/email`, { method: 'POST', body: JSON.stringify(data) }),

  // --- Comments & Pledges ---

  getInvoiceComments: async (invoiceId) =>
    fetchWithAuth(`/fees/invoices/${invoiceId}/comments`),

  addComment: async (invoiceId, data) =>
    fetchWithAuth(`/fees/invoices/${invoiceId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  addPledge: async (invoiceId, data) =>
    fetchWithAuth(`/fees/invoices/${invoiceId}/pledges`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  cancelPledge: async (pledgeId, data = {}) =>
    fetchWithAuth(`/fees/pledges/${pledgeId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  fulfilPledge: async (pledgeId) =>
    fetchWithAuth(`/fees/pledges/${pledgeId}/fulfil`, {
      method: 'PATCH',
      body: JSON.stringify({})
    }),

  // --- Fee Waivers ---

  createWaiver: async (data) =>
    fetchWithAuth('/fees/waivers', { method: 'POST', body: JSON.stringify(data) }),

  listWaivers: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/fees/waivers${query ? `?${query}` : ''}`);
  },

  getWaiverById: async (id) =>
    fetchWithAuth(`/fees/waivers/${id}`),

  approveWaiver: async (id) =>
    fetchWithAuth(`/fees/waivers/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({})
    }),

  rejectWaiver: async (id, data) =>
    fetchWithAuth(`/fees/waivers/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteWaiver: async (id) =>
    fetchWithAuth(`/fees/waivers/${id}`, { method: 'DELETE' }),

  resetAllAccounting: async (data) =>
    fetchWithAuth('/fees/maintenance/reset-all', { method: 'POST', body: JSON.stringify(data) })
};
