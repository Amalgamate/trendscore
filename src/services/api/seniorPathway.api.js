import { fetchWithAuth } from './core';
import { qs } from './factory';

export const seniorPathwayAPI = {
  getCatalog: async () => fetchWithAuth('/senior-pathways/catalog'),
  getCombinations: async (params = {}) =>
    fetchWithAuth(`/senior-pathways/combinations${qs(params)}`),
  getSchoolOfferings: async () => fetchWithAuth('/senior-pathways/offerings'),
  updateSchoolOfferings: async (officialLearningAreaIds = []) =>
    fetchWithAuth('/senior-pathways/offerings', {
      method: 'PUT',
      body: JSON.stringify({ officialLearningAreaIds }),
    }),
  getLearnerSelection: async (learnerId) =>
    fetchWithAuth(`/senior-pathways/learners/${learnerId}/selection`),
  previewLegacySelection: async (learnerId) =>
    fetchWithAuth(`/senior-pathways/learners/${learnerId}/legacy-preview`),
  validateSelection: async (payload) =>
    fetchWithAuth('/senior-pathways/validate-selection', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  saveSelection: async (payload) =>
    fetchWithAuth('/senior-pathways/selections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitSelection: async (selectionId) =>
    fetchWithAuth(`/senior-pathways/selections/${selectionId}/submit`, {
      method: 'POST',
    }),

  approveSelection: async (selectionId) =>
    fetchWithAuth(`/senior-pathways/selections/${selectionId}/approve`, {
      method: 'POST',
    }),

  requestRevision: async (selectionId, reason) =>
    fetchWithAuth(`/senior-pathways/selections/${selectionId}/request-revision`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  lockSelection: async (selectionId) =>
    fetchWithAuth(`/senior-pathways/selections/${selectionId}/lock`, {
      method: 'POST',
    }),

  getSearchCriteria: async (learnerId) =>
    fetchWithAuth(`/senior-pathways/learners/${learnerId}/search-criteria`),

  updateSearchCriteria: async (learnerId, payload) =>
    fetchWithAuth(`/senior-pathways/learners/${learnerId}/search-criteria`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
