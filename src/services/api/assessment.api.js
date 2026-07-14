import { fetchWithAuth, cachedFetch, cacheDel, cacheDelPrefix, TTL } from './core';
import axiosInstance from './axiosConfig';

export const assessmentAPI = {
  createFormative: async (assessmentData) =>
    fetchWithAuth('/assessments/formative', { method: 'POST', body: JSON.stringify(assessmentData) }),
  recordFormativeBulk: async (bulkData) =>
    fetchWithAuth('/assessments/formative/bulk', { method: 'POST', body: JSON.stringify(bulkData) }),
  getFormativeAssessments: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/assessments/formative${queryString ? `?${queryString}` : ''}`);
  },
  getFormativeByLearner: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/assessments/formative/learner/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },
  deleteFormative: async (id) =>
    fetchWithAuth(`/assessments/formative/${id}`, { method: 'DELETE' }),

  createTest: async (testData) => {
    cacheDelPrefix('tests:');
    return fetchWithAuth('/assessments/tests', { method: 'POST', body: JSON.stringify(testData) });
  },
  bulkCreateTests: async (bulkData) => {
    cacheDelPrefix('tests:');
    return fetchWithAuth('/assessments/tests/bulk', { method: 'POST', body: JSON.stringify(bulkData) });
  },
  getTests: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const key = `tests:${queryString}`;
    return cachedFetch(key, () => fetchWithAuth(`/assessments/tests${queryString ? `?${queryString}` : ''}`), TTL.MEDIUM);
  },
  getTest: async (id) =>
    cachedFetch(`test:${id}`, () => fetchWithAuth(`/assessments/tests/${id}`), TTL.MEDIUM),
  updateTest: async (id, testData) => {
    cacheDel(`test:${id}`);
    cacheDelPrefix('tests:');
    return fetchWithAuth(`/assessments/tests/${id}`, { method: 'PUT', body: JSON.stringify(testData) });
  },
  deleteTest: async (id) => {
    cacheDel(`test:${id}`);
    cacheDelPrefix('tests:');
    return fetchWithAuth(`/assessments/tests/${id}`, { method: 'DELETE' });
  },
  deleteTestsBulk: async (ids) => {
    cacheDelPrefix('tests:');
    return fetchWithAuth('/assessments/tests/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) });
  },

  recordResult: async (resultData) => {
    cacheDel(`results:${resultData.testId}`);
    return fetchWithAuth('/assessments/summative/results', { method: 'POST', body: JSON.stringify(resultData) });
  },
  recordBulkResults: async (bulkData) => {
    const result = await fetchWithAuth('/assessments/summative/results/bulk', {
      method: 'POST',
      body: JSON.stringify(bulkData),
    });
    cacheDel(`results:${bulkData.testId}`);
    return result;
  },
  getBulkResults: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/assessments/summative/results/bulk${queryString ? `?${queryString}` : ''}`);
  },
  getSummativeByLearner: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/assessments/summative/results/learner/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },
  async getTestResults(testId) {
    return fetchWithAuth(`/assessments/summative/results/test/${testId}`);
  },
  async uploadBulk(formData) {
    return fetchWithAuth('/bulk/assessments/upload', { method: 'POST', body: formData, headers: {} });
  },

  createScalesForSchool: async (data = {}) =>
    fetchWithAuth('/assessments/setup/create-scales', { method: 'POST', body: JSON.stringify(data) }),
  createTestsForScales: async (data) =>
    fetchWithAuth('/assessments/setup/create-tests', { method: 'POST', body: JSON.stringify(data) }),
  completeSchoolSetup: async (data) =>
    fetchWithAuth('/assessments/setup/complete', { method: 'POST', body: JSON.stringify(data) }),
  seedTransitionDemoScores: async (data = {}) =>
    fetchWithAuth('/assessments/setup/transition-demo', { method: 'POST', body: JSON.stringify(data) }),
  resetAssessments: async (data) =>
    fetchWithAuth('/assessments/setup/reset', { method: 'POST', body: JSON.stringify(data) }),
};
