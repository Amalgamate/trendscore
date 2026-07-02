import { fetchWithAuth } from './core';

export const lmsAPI = {
  // ─── Courses ───────────────────────────────────────────────────────────────
  getCourses: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/courses${queryString ? `?${queryString}` : ''}`);
  },
  getCourse: async (id) => fetchWithAuth(`/lms/courses/${id}`),
  createCourse: async (data) =>
    fetchWithAuth('/lms/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: async (id, data) =>
    fetchWithAuth(`/lms/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourse: async (id) =>
    fetchWithAuth(`/lms/courses/${id}`, { method: 'DELETE' }),

  // ─── Content ───────────────────────────────────────────────────────────────
  getContent: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/content${queryString ? `?${queryString}` : ''}`);
  },
  uploadContent: async (data) =>
    fetchWithAuth('/lms/content', { method: 'POST', body: JSON.stringify(data) }),
  deleteContent: async (id) =>
    fetchWithAuth(`/lms/content/${id}`, { method: 'DELETE' }),

  // ─── Enrollments ───────────────────────────────────────────────────────────
  getEnrollments: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/enrollments${queryString ? `?${queryString}` : ''}`);
  },
  enrollLearner: async (data) =>
    fetchWithAuth('/lms/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  unenrollLearner: async (id) =>
    fetchWithAuth(`/lms/enrollments/${id}`, { method: 'DELETE' }),

  // ─── Progress ──────────────────────────────────────────────────────────────
  getLearnerProgress: async (learnerId, courseId) =>
    fetchWithAuth(`/lms/progress/${learnerId}/${courseId}`),
  updateProgress: async (enrollmentId, data) =>
    fetchWithAuth(`/lms/progress/${enrollmentId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ─── Reports & Dashboard ───────────────────────────────────────────────────
  getReports: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/reports${queryString ? `?${queryString}` : ''}`);
  },
  getDashboardStats: async () => fetchWithAuth('/lms/dashboard/stats'),

  // ─── Settings ──────────────────────────────────────────────────────────────
  getSettings: async () => fetchWithAuth('/lms/settings'),
  updateSettings: async (data) =>
    fetchWithAuth('/lms/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
