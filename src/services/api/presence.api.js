/**
 * Presence Platform API
 * Covers /api/v1/presence/* endpoints
 */
import { fetchWithAuth } from './core';

export const presenceAPI = {
  /** GET /api/v1/presence/learner/:id/today */
  getLearnerTimelineToday: (learnerId) =>
    fetchWithAuth(`/v1/presence/learner/${learnerId}/today`),

  /** GET /api/v1/presence/learner/:id/timeline?date=YYYY-MM-DD */
  getLearnerTimeline: (learnerId, date) =>
    fetchWithAuth(`/v1/presence/learner/${learnerId}/timeline${date ? `?date=${date}` : ''}`),

  /** GET /api/v1/presence/school/snapshot */
  getSchoolSnapshot: () =>
    fetchWithAuth('/v1/presence/school/snapshot'),

  /** GET /api/v1/presence/school/absent-today */
  getAbsentToday: () =>
    fetchWithAuth('/v1/presence/school/absent-today'),
};
