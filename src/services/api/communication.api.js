import { fetchWithAuth } from './core';
import axiosInstance from './axiosConfig';

export const communicationAPI = {
  getConfig: async () => fetchWithAuth('/communication/config'),
  getSmsBalance: async () => fetchWithAuth('/communication/balance'),
  initiateSmsTopUp: async (data) =>
    fetchWithAuth('/communication/top-up', { method: 'POST', body: JSON.stringify(data) }),
  saveConfig: async (data) =>
    fetchWithAuth('/communication/config', { method: 'POST', body: JSON.stringify(data) }),
  sendTestSMS: async (data) =>
    fetchWithAuth('/communication/test/sms', { method: 'POST', body: JSON.stringify(data) }),
  sendTestEmail: async (data) =>
    fetchWithAuth('/communication/test/email', { method: 'POST', body: JSON.stringify(data) }),
  draftEmailTemplate: async (data) =>
    fetchWithAuth('/communication/email/draft', { method: 'POST', body: JSON.stringify(data) }),
  getBirthdaysToday: async () => fetchWithAuth('/communication/birthdays/today'),
  sendBirthdayWishes: async (data) =>
    fetchWithAuth('/communication/birthdays/send', { method: 'POST', body: JSON.stringify(data) }),
  getInboxMessages: async () => fetchWithAuth('/communication/messages/inbox'),
  markMessageRead: async (receiptId) =>
    fetchWithAuth(`/communication/messages/receipts/${receiptId}/read`, { method: 'PATCH' }),
  getRecipients: async (grade) => {
    const params = grade ? `?grade=${encodeURIComponent(grade)}` : '';
    return fetchWithAuth(`/communication/recipients${params}`);
  },
  getAllRecipients: async () => fetchWithAuth('/communication/recipients'),
  getStaffContacts: async () => fetchWithAuth('/communication/staff'),
  getContactGroups: async () => fetchWithAuth('/communication/groups'),
  getContactGroupById: async (id) => fetchWithAuth(`/communication/groups/${id}`),
  createContactGroup: async (data) =>
    fetchWithAuth('/communication/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateContactGroup: async (id, data) =>
    fetchWithAuth(`/communication/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContactGroup: async (id) =>
    fetchWithAuth(`/communication/groups/${id}`, { method: 'DELETE' }),
};
