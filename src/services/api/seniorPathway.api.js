import { fetchWithAuth } from './core';

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const seniorPathwayAPI = {
  getCatalog: async () => fetchWithAuth('/senior-pathways/catalog'),
  getCombinations: async (params = {}) =>
    fetchWithAuth(`/senior-pathways/combinations${toQueryString(params)}`),
  getSchoolOfferings: async () => fetchWithAuth('/senior-pathways/offerings'),
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
};
