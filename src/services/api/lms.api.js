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

  // ─── Assignments ───────────────────────────────────────────────────────────
  getAssignments: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/assignments${queryString ? `?${queryString}` : ''}`);
  },
  getAssignment: async (id) => fetchWithAuth(`/lms/assignments/${id}`),
  createAssignment: async (data) =>
    fetchWithAuth('/lms/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: async (id, data) =>
    fetchWithAuth(`/lms/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssignment: async (id) =>
    fetchWithAuth(`/lms/assignments/${id}`, { method: 'DELETE' }),
  publishAssignment: async (id) =>
    fetchWithAuth(`/lms/assignments/${id}/publish`, { method: 'POST' }),
  closeAssignment: async (id) =>
    fetchWithAuth(`/lms/assignments/${id}/close`, { method: 'POST' }),

  // ─── Submissions ────────────────────────────────────────────────────────────
  getSubmissions: async (assignmentId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/assignments/${assignmentId}/submissions${queryString ? `?${queryString}` : ''}`);
  },
  getMySubmissions: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/submissions/my${queryString ? `?${queryString}` : ''}`);
  },
  submitAssignment: async (assignmentId, formData) =>
    fetchWithAuth(`/lms/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — browser sets it with boundary for multipart
      headers: {},
    }),
  markSubmission: async (submissionId, data) =>
    fetchWithAuth(`/lms/submissions/${submissionId}/mark`, { method: 'POST', body: JSON.stringify(data) }),

  // ─── Lessons ───────────────────────────────────────────────────────────────
  getLessons: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/lessons${queryString ? `?${queryString}` : ''}`);
  },
  getLesson: async (id) => fetchWithAuth(`/lms/lessons/${id}`),
  // Kept as an explicit alias for the lesson builder, whose endpoint returns
  // the lesson together with ordered content blocks.
  getLessonWithBlocks: async (id) => fetchWithAuth(`/lms/lessons/${id}`),
  createLesson: async (data) =>
    fetchWithAuth('/lms/lessons', { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: async (id, data) =>
    fetchWithAuth(`/lms/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLesson: async (id) =>
    fetchWithAuth(`/lms/lessons/${id}`, { method: 'DELETE' }),
  publishLesson: async (id) =>
    fetchWithAuth(`/lms/lessons/${id}/publish`, { method: 'PUT' }),
  archiveLesson: async (id) =>
    fetchWithAuth(`/lms/lessons/${id}/archive`, { method: 'POST' }),
  getLessonWithBlocks: async (id) => fetchWithAuth(`/lms/lessons/${id}`),
  upsertLessonBlocks: async (id, blocks) =>
    fetchWithAuth(`/lms/lessons/${id}/blocks`, { method: 'POST', body: JSON.stringify({ blocks }) }),
  /**
   * Upload a single media file (image/video/audio/pdf/diagram) for use inside
   * a lesson content block. Returns { url, fileName, fileSize, fileType }.
   */
  uploadLessonMedia: async (formData) =>
    fetchWithAuth('/lms/lessons/media', {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — browser sets it with boundary for multipart
      headers: {},
    }),

  // ─── Resources (Revision Library) ─────────────────────────────────────────
  getResources: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/resources${queryString ? `?${queryString}` : ''}`);
  },
  getResource: async (id) => fetchWithAuth(`/lms/resources/${id}`),
  createResource: async (formData) =>
    fetchWithAuth('/lms/resources', {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — browser sets it with boundary for multipart
      headers: {},
    }),
  updateResource: async (id, data) =>
    fetchWithAuth(`/lms/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteResource: async (id) =>
    fetchWithAuth(`/lms/resources/${id}`, { method: 'DELETE' }),
  downloadResource: async (id) =>
    fetchWithAuth(`/lms/resources/${id}/download`, { method: 'POST' }),
  toggleBookmark: async (id) =>
    fetchWithAuth(`/lms/resources/${id}/bookmark`, { method: 'POST' }),

  // ─── Settings ──────────────────────────────────────────────────────────────
  getSettings: async () => fetchWithAuth('/lms/settings'),
  updateSettings: async (data) =>
    fetchWithAuth('/lms/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // ─── Analytics & Insights ─────────────────────────────────────────────────
  /**
   * GET /api/lms/analytics/overview?termId=...
   * NOTE: termId is required by the backend.
   */
  getAnalyticsOverview: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/analytics/overview${queryString ? `?${queryString}` : ''}`);
  },

  /** GET /api/lms/analytics/assignments?termId=... */
  getAssignmentAnalytics: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/analytics/assignments${queryString ? `?${queryString}` : ''}`);
  },

  /** GET /api/lms/analytics/lessons */
  getLessonEngagementStats: async () => fetchWithAuth('/lms/analytics/lessons'),

  /** GET /api/lms/analytics/class/:classId?termId=... */
  getClassAnalytics: async (classId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/analytics/class/${classId}${queryString ? `?${queryString}` : ''}`);
  },

  /** GET /api/lms/analytics/learner/:learnerId?termId=... */
  getLearnerAnalytics: async (learnerId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/analytics/learner/${learnerId}${queryString ? `?${queryString}` : ''}`);
  },

  /** GET /api/lms/analytics/leaderboard?limit=10 */
  getLeaderboard: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/analytics/leaderboard${queryString ? `?${queryString}` : ''}`);
  },

  /** GET /api/lms/achievements — authenticated student's XP, level, streak and badges */
  getAchievements: async () => fetchWithAuth('/lms/achievements'),

  // Legacy placeholder (there is no generic GET /api/lms/analytics endpoint)
  getAnalytics: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/analytics${queryString ? `?${queryString}` : ''}`);
  },

  // ─── Student Portal ────────────────────────────────────────────────────────
  /** Returns the list of courses the authenticated learner is enrolled in */
  getStudentCourses: async () => fetchWithAuth('/lms/my-courses'),
  /** Returns detail + lessons for a single enrolled course */
  getStudentCourseDetail: async (courseId) => fetchWithAuth(`/lms/my-courses/${courseId}`),
  /** Returns assignments for the authenticated learner */
  getStudentAssignments: async () => fetchWithAuth('/lms/my-assignments'),

  /**
   * Returns published assignments (with submission status) for a specific child.
   * For use by the parent portal — the server enforces own-children-only access.
   */
  getChildAssignments: async (learnerId) =>
    fetchWithAuth(`/lms/children/${learnerId}/assignments`),
};
