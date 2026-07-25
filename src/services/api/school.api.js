import { fetchWithAuth } from './core';

export const schoolAPI = {
  getAll: async () => fetchWithAuth('/schools'),
  getById: async (id) => fetchWithAuth(`/schools/${id}`),
  updateCurrent: async (data, authToken) =>
    fetchWithAuth('/schools', {
      method: 'PUT',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: JSON.stringify(data),
    }),
  deactivateCurrent: async () =>
    fetchWithAuth('/schools/deactivate', { method: 'POST' }),
  deleteCurrent: async () =>
    fetchWithAuth('/schools', { method: 'DELETE' }),
  provision: async (data) =>
    fetchWithAuth('/schools/provision', { method: 'POST', body: JSON.stringify(data) }),
  getAdmissionNumberPreview: async (academicYear) =>
    fetchWithAuth(`/schools/admission-number-preview/${academicYear}`),
  lockInstitutionType: async (institutionType, authToken) =>
    fetchWithAuth('/schools/institution-type/lock', {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: JSON.stringify({ institutionType }),
    }),
  getInstitutionSetupProgress: async (institutionType, authToken) =>
    fetchWithAuth(`/schools/institution-setup/progress/${institutionType}`, {
      method: 'GET',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    }),
  resetWholeInstitution: async (confirmToken) =>
    fetchWithAuth('/schools/maintenance/reset-whole-institution', {
      method: 'POST',
      body: JSON.stringify({ confirmToken }),
    }),
  getModules: async () => fetchWithAuth('/schools/modules/config'),
  updateModules: async (data) =>
    fetchWithAuth('/schools/modules/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  applyModulePackage: async (packageId) =>
    fetchWithAuth('/schools/modules/package', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    }),
};
