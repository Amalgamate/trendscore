import { fetchWithAuth } from './core';
import { resourceApi } from './factory';

export const subjectAssignmentAPI = {
  ...resourceApi('/subject-assignments'),
  getEligibleTeachers: async (learningAreaId, grade) =>
    fetchWithAuth(`/subject-assignments/eligible-teachers?learningAreaId=${learningAreaId}&grade=${grade}`),
};
