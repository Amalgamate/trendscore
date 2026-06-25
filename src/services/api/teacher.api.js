import { userAPI } from './user.api';
import { fetchWithAuth } from './core';

export const teacherAPI = {
  getAll: async (params = {}) => userAPI.getByRole('TEACHER', params),
  create: async (teacherData) => userAPI.create({ ...teacherData, role: 'TEACHER' }),
  update: async (id, teacherData) => userAPI.update(id, teacherData),
  uploadPhoto: async (id, photoData) => userAPI.uploadPhoto(id, photoData),
  delete: async (id) => userAPI.delete(id),

  /**
   * Returns the authenticated teacher's scoped context:
   * isClassTeacher, classTeacherOf, subjectAssignments, assignedGrades, etc.
   * Non-TEACHER privileged roles receive { restricted: false }.
   */
  getMyContext: async () => fetchWithAuth('/teacher/context'),
};
