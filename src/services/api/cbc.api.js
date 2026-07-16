import { fetchWithAuth } from './core';
import axiosInstance from './axiosConfig';

export const cbcAPI = {
  getHolisticSummary: async (params = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ).toString();
    return fetchWithAuth(`/cbc/holistic-summary${queryString ? `?${queryString}` : ''}`);
  },
  saveCompetencies: async (data) =>
    fetchWithAuth('/cbc/competencies', { method: 'POST', body: JSON.stringify(data) }),
  getCompetencies: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/cbc/competencies/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },
  saveCompetenciesBulk: async (data) =>
    fetchWithAuth('/cbc/competencies/bulk', { method: 'POST', body: JSON.stringify(data) }),
  saveValues: async (data) =>
    fetchWithAuth('/cbc/values', { method: 'POST', body: JSON.stringify(data) }),
  saveValuesBulk: async (data) =>
    fetchWithAuth('/cbc/values/bulk', { method: 'POST', body: JSON.stringify(data) }),
  getValues: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/cbc/values/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },
  createCoCurricular: async (data) =>
    fetchWithAuth('/cbc/cocurricular', { method: 'POST', body: JSON.stringify(data) }),
  createCoCurricularBulk: async (data) =>
    fetchWithAuth('/cbc/cocurricular/bulk', { method: 'POST', body: JSON.stringify(data) }),
  getCoCurricular: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/cbc/cocurricular/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },
  updateCoCurricular: async (id, data) =>
    fetchWithAuth(`/cbc/cocurricular/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCoCurricular: async (id) =>
    fetchWithAuth(`/cbc/cocurricular/${id}`, { method: 'DELETE' }),
  saveComments: async (data) =>
    fetchWithAuth('/cbc/comments', { method: 'POST', body: JSON.stringify(data) }),
  getComments: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/cbc/comments/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },
};
