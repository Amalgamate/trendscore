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
  // Academic year setup: all three terms plus break and exam dates in one call.
  getAcademicYearSetup: async (academicYear) =>
    fetchWithAuth(`/config/academic-year/${academicYear}`),
  checkAcademicYearSetup: async (plan) =>
    fetchWithAuth('/config/academic-year', { method: 'POST', body: JSON.stringify({ ...plan, dryRun: true }) }),
  saveAcademicYearSetup: async (plan) =>
    fetchWithAuth('/config/academic-year', { method: 'POST', body: JSON.stringify({ ...plan, dryRun: false }) }),
};
