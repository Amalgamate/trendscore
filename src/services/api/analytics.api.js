/**
 * Analytics & Intelligence API
 * Covers /api/v1/analytics/* endpoints
 */
import { fetchWithAuth } from './core';

export const analyticsAPI = {
  /** GET /api/v1/analytics/school/overview */
  getOverview: () =>
    fetchWithAuth('/v1/analytics/school/overview'),

  /** GET /api/v1/analytics/attendance/daily?daysBack=14 */
  getDailyRates: (daysBack = 14) =>
    fetchWithAuth(`/v1/analytics/attendance/daily?daysBack=${daysBack}`),

  /** GET /api/v1/analytics/attendance/weekly?weeksBack=8 */
  getWeeklyTrend: (weeksBack = 8) =>
    fetchWithAuth(`/v1/analytics/attendance/weekly?weeksBack=${weeksBack}`),

  /** GET /api/v1/analytics/attendance/by-grade */
  getByGrade: () =>
    fetchWithAuth('/v1/analytics/attendance/by-grade'),

  /** GET /api/v1/analytics/at-risk?daysBack=28&limit=50 */
  getAtRisk: (daysBack = 28, limit = 50) =>
    fetchWithAuth(`/v1/analytics/at-risk?daysBack=${daysBack}&limit=${limit}`),

  /** GET /api/v1/analytics/late-patterns?daysBack=14 */
  getLatePatterns: (daysBack = 14) =>
    fetchWithAuth(`/v1/analytics/late-patterns?daysBack=${daysBack}`),

  /** GET /api/v1/analytics/boarding/compliance?daysBack=7 */
  getBoardingCompliance: (daysBack = 7) =>
    fetchWithAuth(`/v1/analytics/boarding/compliance?daysBack=${daysBack}`),

  /** POST /api/v1/analytics/early-warning/run */
  runEarlyWarning: () =>
    fetchWithAuth('/v1/analytics/early-warning/run', { method: 'POST' }),

  /** GET /api/v1/analytics/early-warning/violations */
  getViolations: () =>
    fetchWithAuth('/v1/analytics/early-warning/violations'),

  /** POST /api/v1/analytics/early-warning/violations/:id/resolve */
  resolveViolation: (id, resolution) =>
    fetchWithAuth(`/v1/analytics/early-warning/violations/${id}/resolve`, {
      method: 'POST', body: JSON.stringify({ resolution }),
    }),

  /** GET /api/v1/analytics/nemis/report?term=TERM_1&academicYear=2026 */
  getNemisReport: (term, academicYear) =>
    fetchWithAuth(`/v1/analytics/nemis/report?term=${term}&academicYear=${academicYear}`),
};
