import { fetchWithAuth } from './core';
import { resourceApi } from './factory';

export const documentsAPI = {
  ...resourceApi('/documents'),
  getCategories: async () => fetchWithAuth('/documents/categories'),
  upload: async (formData, onUploadProgress) =>
    fetchWithAuth('/documents/upload', { method: 'POST', body: formData, onUploadProgress }),
  uploadMultiple: async (formData, onUploadProgress) =>
    fetchWithAuth('/documents/upload-multiple', { method: 'POST', body: formData, onUploadProgress }),
};
