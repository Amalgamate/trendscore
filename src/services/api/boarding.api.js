/**
 * Boarding Module API
 * Covers /api/v1/boarding/* endpoints
 */
import { fetchWithAuth } from './core';

export const boardingAPI = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard: () => fetchWithAuth('/v1/boarding'),

  // ── Dormitories ────────────────────────────────────────────────────────────
  getDormitories: (includeArchived = false) =>
    fetchWithAuth(`/v1/boarding/dormitories${includeArchived ? '?archived=true' : ''}`),

  createDormitory: (data) =>
    fetchWithAuth('/v1/boarding/dormitories', { method: 'POST', body: JSON.stringify(data) }),

  updateDormitory: (id, data) =>
    fetchWithAuth(`/v1/boarding/dormitories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Beds ───────────────────────────────────────────────────────────────────
  getBeds: (dormitoryId) =>
    fetchWithAuth(`/v1/boarding/dormitories/${dormitoryId}/beds`),

  createBed: (dormitoryId, data) =>
    fetchWithAuth(`/v1/boarding/dormitories/${dormitoryId}/beds`, { method: 'POST', body: JSON.stringify(data) }),

  // ── Assignments ────────────────────────────────────────────────────────────
  assignLearner: (data) =>
    fetchWithAuth('/v1/boarding/assignments', { method: 'POST', body: JSON.stringify(data) }),

  getLearnerAssignment: (learnerId) =>
    fetchWithAuth(`/v1/boarding/assignments/learner/${learnerId}`),

  // ── House Masters ──────────────────────────────────────────────────────────
  assignHouseMaster: (data) =>
    fetchWithAuth('/v1/boarding/house-masters', { method: 'POST', body: JSON.stringify(data) }),

  getHouseMasters: (dormitoryId) =>
    fetchWithAuth(`/v1/boarding/dormitories/${dormitoryId}/house-masters`),

  // ── Exeat ──────────────────────────────────────────────────────────────────
  getExeats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithAuth(`/v1/boarding/exeat${qs ? `?${qs}` : ''}`);
  },

  requestExeat: (data) =>
    fetchWithAuth('/v1/boarding/exeat', { method: 'POST', body: JSON.stringify(data) }),

  approveExeat: (exeatId, data) =>
    fetchWithAuth(`/v1/boarding/exeat/${exeatId}/approve`, { method: 'POST', body: JSON.stringify(data) }),

  recordDeparture: (exeatId) =>
    fetchWithAuth(`/v1/boarding/exeat/${exeatId}/depart`, { method: 'POST' }),

  recordReturn: (exeatId) =>
    fetchWithAuth(`/v1/boarding/exeat/${exeatId}/return`, { method: 'POST' }),

  // ── Roll Call ──────────────────────────────────────────────────────────────
  startRollCall: (data) =>
    fetchWithAuth('/v1/boarding/roll-calls', { method: 'POST', body: JSON.stringify(data) }),

  getRollCall: (rollCallId) =>
    fetchWithAuth(`/v1/boarding/roll-calls/${rollCallId}`),

  markEntry: (rollCallId, data) =>
    fetchWithAuth(`/v1/boarding/roll-calls/${rollCallId}/entries`, { method: 'POST', body: JSON.stringify(data) }),

  bulkMarkEntries: (rollCallId, entries) =>
    fetchWithAuth(`/v1/boarding/roll-calls/${rollCallId}/entries/bulk`, {
      method: 'POST', body: JSON.stringify({ entries }),
    }),

  completeRollCall: (rollCallId) =>
    fetchWithAuth(`/v1/boarding/roll-calls/${rollCallId}/complete`, { method: 'POST' }),

  // ── Dining ─────────────────────────────────────────────────────────────────
  markDining: (data) =>
    fetchWithAuth('/v1/boarding/dining', { method: 'POST', body: JSON.stringify(data) }),

  bulkMarkDining: (data) =>
    fetchWithAuth('/v1/boarding/dining/bulk', { method: 'POST', body: JSON.stringify(data) }),

  // ── Prep ───────────────────────────────────────────────────────────────────
  markPrep: (data) =>
    fetchWithAuth('/v1/boarding/prep', { method: 'POST', body: JSON.stringify(data) }),
};
