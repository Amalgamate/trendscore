import { fetchWithAuth, cachedFetch, cacheDelPrefix, TTL } from './core';

export const classAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/classes${queryString ? `?${queryString}` : ''}`);
  },
  getById: async (id) => fetchWithAuth(`/classes/${id}`),
  create: async (classData) => {
    const result = await fetchWithAuth('/classes', { method: 'POST', body: JSON.stringify(classData) });
    cacheDelPrefix('teacher-workload:');
    return result;
  },
  update: async (id, classData) => {
    const result = await fetchWithAuth(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(classData) });
    cacheDelPrefix('teacher-workload:');
    return result;
  },
  enrollLearner: async (classId, learnerId) => {
    const result = await fetchWithAuth('/classes/enroll', { method: 'POST', body: JSON.stringify({ classId, learnerId }) });
    cacheDelPrefix('teacher-workload:');
    return result;
  },
  unenrollLearner: async (classId, learnerId) => {
    const result = await fetchWithAuth('/classes/unenroll', { method: 'POST', body: JSON.stringify({ classId, learnerId }) });
    cacheDelPrefix('teacher-workload:');
    return result;
  },
  getLearnerClass: async (learnerId) => fetchWithAuth(`/classes/learner/${learnerId}`),
  assignTeacher: async (classId, teacherId) => {
    const result = await fetchWithAuth('/classes/assign-teacher', { method: 'POST', body: JSON.stringify({ classId, teacherId }) });
    cacheDelPrefix('teacher-workload:');
    return result;
  },
  unassignTeacher: async (classId) => {
    const result = await fetchWithAuth('/classes/unassign-teacher', { method: 'POST', body: JSON.stringify({ classId }) });
    cacheDelPrefix('teacher-workload:');
    return result;
  },
  getTeacherWorkload: async (teacherId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const key = `teacher-workload:${teacherId}:${queryString}`;
    return cachedFetch(
      key,
      () => fetchWithAuth(`/classes/teacher/${teacherId}/workload${queryString ? `?${queryString}` : ''}`),
      TTL.MEDIUM
    );
  },
  getTeacherSchedules: async (teacherId) => fetchWithAuth(`/classes/teacher/${teacherId}/schedules`),
  getSchedules: async (classId) => fetchWithAuth(`/classes/${classId}/schedules`),
  addSchedule: async (classId, data) =>
    fetchWithAuth(`/classes/${classId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: async (classId, scheduleId, data) =>
    fetchWithAuth(`/classes/${classId}/schedules/${scheduleId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: async (classId, scheduleId) =>
    fetchWithAuth(`/classes/${classId}/schedules/${scheduleId}`, { method: 'DELETE' }),
  getAllClassData: async (classId) => {
    const [details, schedules] = await Promise.all([
      fetchWithAuth(`/classes/${classId}`),
      fetchWithAuth(`/classes/${classId}/schedules`),
    ]);

    return {
      ...details,
      schedules: Array.isArray(schedules) ? schedules : schedules?.data || [],
      scheduleCount: Array.isArray(schedules) ? schedules.length : schedules?.data?.length || 0,
    };
  },
};
