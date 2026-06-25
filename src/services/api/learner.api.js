import { fetchWithAuth, cachedFetch, cacheDelPrefix, TTL } from './core';
import { communicationAPI } from './communication.api';

const institutionCacheKeySuffix = () => {
  try {
    localStorage.removeItem('selectedInstitutionType');
    const raw = localStorage.getItem('user');
    if (!raw) return 'PRIMARY_CBC';
    const u = JSON.parse(raw);
    return u?.institutionType || 'PRIMARY_CBC';
  } catch {
    return 'PRIMARY_CBC';
  }
};

export const learnerAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const suffix = institutionCacheKeySuffix();
    const cacheKey = `learners:${suffix}:${queryString}`;
    return cachedFetch(
      cacheKey,
      () => fetchWithAuth(`/learners${queryString ? `?${queryString}` : ''}`),
      TTL.SHORT
    );
  },
  getStats: async () => fetchWithAuth('/learners/stats'),
  getNextAdmissionNumber: async () => fetchWithAuth('/learners/next-admission-number'),
  getById: async (id) => fetchWithAuth(`/learners/${id}`),
  getByAdmissionNumber: async (admissionNumber) =>
    fetchWithAuth(`/learners/admission/${admissionNumber}`),
  getByGrade: async (grade, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/learners/grade/${grade}${queryString ? `?${queryString}` : ''}`);
  },
  getParentChildren: async (parentId) => fetchWithAuth(`/learners/parent/${parentId}`),
  create: async (learnerData) => {
    cacheDelPrefix('learners:');
    return fetchWithAuth('/learners', { method: 'POST', body: JSON.stringify(learnerData) });
  },
  update: async (id, learnerData) => {
    cacheDelPrefix('learners:');
    return fetchWithAuth(`/learners/${id}`, { method: 'PUT', body: JSON.stringify(learnerData) });
  },
  parentUpdate: async (id, data) => {
    // Scoped parent-safe update — only firstName, lastName, photo allowed
    // No EDIT_LEARNER permission required; server verifies parentId ownership
    return fetchWithAuth(`/learners/${id}/parent-update`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete: async (id) => {
    cacheDelPrefix('learners:');
    return fetchWithAuth(`/learners/${id}`, { method: 'DELETE' });
  },
  uploadPhoto: async (id, photoData) =>
    fetchWithAuth(`/learners/${id}/photo`, { method: 'POST', body: JSON.stringify({ photoData }) }),
  transferOut: async (transferData) =>
    fetchWithAuth('/learners/transfer-out', { method: 'POST', body: JSON.stringify(transferData) }),
  bulkPromote: async (promotionData) => {
    cacheDelPrefix('learners:');
    return fetchWithAuth('/learners/bulk-promote', { method: 'POST', body: JSON.stringify(promotionData) });
  },
  getBirthdays: async () => communicationAPI.getBirthdaysToday(),
};
