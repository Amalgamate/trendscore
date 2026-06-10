import { userAPI } from './user.api';

export const teacherAPI = {
  getAll: async (params = {}) => userAPI.getByRole('TEACHER', params),
  create: async (teacherData) => userAPI.create({ ...teacherData, role: 'TEACHER' }),
  update: async (id, teacherData) => userAPI.update(id, teacherData),
  uploadPhoto: async (id, photoData) => userAPI.uploadPhoto(id, photoData),
  delete: async (id) => userAPI.delete(id),
};
