import { fetchWithAuth } from './core';

export const pathwayAPI = {
  listPathways: async () => fetchWithAuth('/pathways'),
  getCatalogIntegrity: async () => fetchWithAuth('/pathways/integrity'),
  getPathwayCategories: async (code) => fetchWithAuth(`/pathways/${code}/categories`),
  getLearnerPathwayProfile: async (learnerId) => fetchWithAuth(`/pathways/learner/${learnerId}`),
  setLearnerPathway: async (learnerId, pathwayCode) =>
    fetchWithAuth(`/pathways/learner/${learnerId}/pathway`, {
      method: 'POST',
      body: JSON.stringify({ pathwayCode }),
    }),
  setLearnerSubjects: async (learnerId, selections) =>
    fetchWithAuth(`/pathways/learner/${learnerId}/subjects`, {
      method: 'POST',
      body: JSON.stringify({ selections }),
    }),
  getRecommendation: async (learnerId, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value === undefined || value === null || value === '') return acc;
        acc[key] = String(value);
        return acc;
      }, {})
    ).toString();
    return fetchWithAuth(`/pathways/recommendations/${learnerId}${query ? `?${query}` : ''}`);
  },
  getTransitionReadiness: async (learnerId, payload = {}) =>
    fetchWithAuth(`/pathways/transition/${learnerId}/readiness`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  saveTransitionDecision: async (learnerId, payload = {}) =>
    fetchWithAuth(`/pathways/transition/${learnerId}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // Parent-only endpoint — only accepts { parentPreference } and preserves all staff fields.
  saveParentPreference: async (learnerId, parentPreference) =>
    fetchWithAuth(`/pathways/transition/${learnerId}/parent-preference`, {
      method: 'POST',
      body: JSON.stringify({ parentPreference: parentPreference ?? null }),
    }),
  overrideFinalizedDecision: async (learnerId, finalApprovedPathway, reason) =>
    fetchWithAuth(`/pathways/transition/${learnerId}/decision/override`, {
      method: 'POST',
      body: JSON.stringify({ finalApprovedPathway, reason }),
    }),
  getTransitionDecisionHistory: async (learnerId) =>
    fetchWithAuth(`/pathways/transition/${learnerId}/decision-history`),
};
