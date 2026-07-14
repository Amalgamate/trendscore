/**
 * career.api.js
 * Frontend API service for the Career Explorer (SPEC-005).
 * All endpoints are under /api/careers and /api/learners/:learnerId.
 */

import { fetchWithAuth } from './core';
import { qs } from './factory';

export const careerAPI = {

  // ── Career catalogue ────────────────────────────────────────────────────────
  listCareers: (params = {}) =>
    fetchWithAuth(`/careers${qs(params)}`),

  listFamilies: () =>
    fetchWithAuth('/careers/families'),

  getCareer: (careerId) =>
    fetchWithAuth(`/careers/${careerId}`),

  compareCareers: (careerIds, learnerId) =>
    fetchWithAuth(`/careers/compare?ids=${encodeURIComponent(careerIds.join(','))}${learnerId ? `&learnerId=${encodeURIComponent(learnerId)}` : ''}`),

  // ── Admin mutations ─────────────────────────────────────────────────────────
  createCareer: (data) =>
    fetchWithAuth('/careers', { method: 'POST', body: JSON.stringify(data) }),

  updateCareer: (careerId, data) =>
    fetchWithAuth(`/careers/${careerId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  createFamily: (data) =>
    fetchWithAuth('/careers/families', { method: 'POST', body: JSON.stringify(data) }),

  seedCareers: () =>
    fetchWithAuth('/careers/seed', { method: 'POST' }),

  publishCareer: (careerId) =>
    fetchWithAuth(`/careers/${careerId}/publish`, { method: 'POST' }),

  retireCareer: (careerId) =>
    fetchWithAuth(`/careers/${careerId}/retire`, { method: 'POST' }),

  // ── Learner-scoped ──────────────────────────────────────────────────────────
  getLearnerMatches: (learnerId) =>
    fetchWithAuth(`/learners/${learnerId}/career-matches`),

  recalculateMatches: (learnerId) =>
    fetchWithAuth(`/learners/${learnerId}/career-matches/recalculate`, { method: 'POST' }),

  getCombinationImpact: (learnerId, careerIds, combinationIds) =>
    fetchWithAuth(`/learners/${learnerId}/career-combination-impact?careerIds=${encodeURIComponent(careerIds.join(','))}&combinationIds=${encodeURIComponent(combinationIds.join(','))}`),

  getSavedCareers: (learnerId) =>
    fetchWithAuth(`/learners/${learnerId}/saved-careers`),

  saveCareer: (learnerId, careerId, note) =>
    fetchWithAuth(`/learners/${learnerId}/saved-careers`, {
      method: 'POST',
      body: JSON.stringify({ careerId, note }),
    }),

  updateSave: (learnerId, careerId, data) =>
    fetchWithAuth(`/learners/${learnerId}/saved-careers/${careerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  removeCareer: (learnerId, careerId) =>
    fetchWithAuth(`/learners/${learnerId}/saved-careers/${careerId}`, { method: 'DELETE' }),
};
