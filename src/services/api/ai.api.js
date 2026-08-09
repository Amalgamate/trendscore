import { fetchWithAuth } from './core';

export const aiAPI = {
  generateFeedback: async (learnerId, term, academicYear) =>
    fetchWithAuth(`/ai/feedback/${learnerId}?term=${term}&academicYear=${academicYear}`),
  analyzeRisk: async (learnerId) => fetchWithAuth(`/ai/analyze-risk/${learnerId}`),
  getTrend: async (learnerId) => fetchWithAuth(`/ai/trend/${learnerId}`),
  chat: async (payload) => fetchWithAuth('/ai/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getHistory: async (sessionId, limit = 50) =>
    fetchWithAuth(`/ai/history/${encodeURIComponent(sessionId)}?limit=${encodeURIComponent(limit)}`),
  archiveHistory: async (sessionId) =>
    fetchWithAuth(`/ai/history/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
};
