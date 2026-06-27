import { fetchWithAuth } from './core';
import { qs } from './factory';

export const plannerAPI = {
  getEvents: async (params = {}) =>
    fetchWithAuth(`/planner/events${qs(params)}`),
  createEvent: async (data) =>
    fetchWithAuth('/planner/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: async (id, data) =>
    fetchWithAuth(`/planner/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: async (id) =>
    fetchWithAuth(`/planner/events/${id}`, { method: 'DELETE' }),
  getAnnualSummary: async (academicYear) =>
    fetchWithAuth(`/planner/events/annual-summary?academicYear=${academicYear}`),
  bulkCreateAnnualPlan: async (events) =>
    fetchWithAuth('/planner/events/bulk-annual', { method: 'POST', body: JSON.stringify({ events }) }),
};
