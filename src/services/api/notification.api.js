import { fetchWithAuth } from './core';

export const notificationAPI = {
  sendAssessmentNotification: async (data) =>
    fetchWithAuth('/notifications/assessment-complete', { method: 'POST', body: JSON.stringify(data) }),
  sendBulkAssessmentNotifications: async (data) =>
    fetchWithAuth('/notifications/assessment-complete/bulk', { method: 'POST', body: JSON.stringify(data) }),
  sendCustomMessage: async (data) =>
    fetchWithAuth('/notifications/custom', { method: 'POST', body: JSON.stringify(data) }),
  sendAnnouncement: async (data) =>
    fetchWithAuth('/notifications/announcement', { method: 'POST', body: JSON.stringify(data) }),
  sendAssessmentReportSms: async (data) =>
    fetchWithAuth('/notifications/sms/assessment-report', { method: 'POST', body: JSON.stringify(data) }),
  sendAssessmentReportSmsBulk: async (data) =>
    fetchWithAuth('/notifications/sms/assessment-report/bulk', { method: 'POST', body: JSON.stringify(data) }),
  previewAssessmentReportSmsBulk: async (data) =>
    fetchWithAuth('/notifications/sms/assessment-report/bulk/preview', { method: 'POST', body: JSON.stringify(data) }),
  retryAssessmentReportSms: async (auditId) =>
    fetchWithAuth(`/notifications/sms/assessment-report/${encodeURIComponent(auditId)}/retry`, { method: 'POST' }),
  logCommunication: async (data) =>
    fetchWithAuth('/notifications/log-communication', { method: 'POST', body: JSON.stringify(data) }),
  sendAssessmentReportWhatsApp: async (data) =>
    fetchWithAuth('/notifications/whatsapp/assessment-report', { method: 'POST', body: JSON.stringify(data) }),
  testWhatsApp: async (phoneNumber, message) =>
    fetchWithAuth('/notifications/test', { method: 'POST', body: JSON.stringify({ phoneNumber, message }) }),
  getWhatsAppStatus: async () => fetchWithAuth('/notifications/whatsapp/status'),
  getWhatsAppQR: async () => fetchWithAuth('/notifications/whatsapp/qr'),
  initializeWhatsApp: async () => fetchWithAuth('/notifications/whatsapp/initialize', { method: 'POST' }),
  logoutWhatsApp: async () => fetchWithAuth('/notifications/whatsapp/logout', { method: 'POST' }),
};
