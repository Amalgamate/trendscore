/**
 * pathwayPlanner.api.js
 *
 * Frontend API service for the Pathway Planner module (Phases 2, 3, 4).
 * All endpoints are under /api/pathway-planner/.
 */

import { fetchWithAuth } from './core';

export const pathwayPlannerAPI = {
  // ── Discover Me — learner reflection profile ──────────────────────────────
  getPathwayProfile: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/profile`),

  savePathwayProfile: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getPathwayConversation: (learnerId) => fetchWithAuth(`/pathway-planner/learners/${learnerId}/conversation`),
  addPathwayConversationMessage: (learnerId, message) => fetchWithAuth(`/pathway-planner/learners/${learnerId}/conversation`, { method: 'POST', body: JSON.stringify({ message }) }),

  getAdminDashboard: () => fetchWithAuth('/pathway-planner/admin/dashboard'),
  getAdminReferences: (type) => fetchWithAuth(`/pathway-planner/admin/references/${type}`),
  getAdminReferenceImpact: (type, id) => fetchWithAuth(`/pathway-planner/admin/references/${type}/${id}/impact`),
  saveAdminReference: (type, data) => fetchWithAuth(`/pathway-planner/admin/references/${type}`, { method: 'POST', body: JSON.stringify(data) }),
  publishAdminReference: (type, id, reason = '') => fetchWithAuth(`/pathway-planner/admin/references/${type}/${id}/publish`, { method: 'POST', body: JSON.stringify({ reason }) }),
  retireAdminReference: (type, id, reason = '') => fetchWithAuth(`/pathway-planner/admin/references/${type}/${id}/retire`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getAdminVersions: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
    return fetchWithAuth(`/pathway-planner/admin/versions${query ? `?${query}` : ''}`);
  },
  rollbackAdminVersion: (id, reason = '') => fetchWithAuth(`/pathway-planner/admin/versions/${id}/rollback`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getPathwayRules: () => fetchWithAuth('/pathway-planner/admin/rules'),
  createPathwayRule: (data) => fetchWithAuth('/pathway-planner/admin/rules', { method: 'POST', body: JSON.stringify(data) }),
  publishPathwayRule: (id) => fetchWithAuth(`/pathway-planner/admin/rules/${id}/publish`, { method: 'POST' }),
  getPathwayImports: () => fetchWithAuth('/pathway-planner/admin/imports'),
  createPathwayImport: (data) => fetchWithAuth('/pathway-planner/admin/imports', { method: 'POST', body: JSON.stringify(data) }),
  approvePathwayImport: (id) => fetchWithAuth(`/pathway-planner/admin/imports/${id}/approve`, { method: 'POST' }),
  getPathwayDataQuality: () => fetchWithAuth('/pathway-planner/admin/data-quality'),
  getPathwayAnalytics: () => fetchWithAuth('/pathway-planner/admin/analytics'),
  getPathwayAuditLogs: (query = '') => fetchWithAuth(`/pathway-planner/admin/audit-logs${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  // ── Phase 2 — Counsellor notes ──────────────────────────────────────────
  getCounsellorNotes: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/notes`),

  addCounsellorNote: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Phase 2 — Selection unlock ──────────────────────────────────────────
  getSelectionUnlock: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/unlock`),

  unlockSelection: (learnerId, data = {}) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/unlock`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Phase 2 — Counsellor workbench ─────────────────────────────────────
  getCounsellorSummary: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/counsellor-summary`),

  getClassDistribution: (classId) =>
    fetchWithAuth(`/pathway-planner/classes/${classId}/distribution`),

  // ── Counsellor case management ─────────────────────────────────────────
  getCounsellorDashboard: () =>
    fetchWithAuth('/pathway-planner/counsellor/dashboard'),

  getInterventionQueue: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    ).toString();
    return fetchWithAuth(`/pathway-planner/counsellor/interventions${qs ? `?${qs}` : ''}`);
  },

  bulkUpdateInterventions: (data) =>
    fetchWithAuth('/pathway-planner/counsellor/interventions/bulk', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getCaseManagement: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/case-management`),

  getParticipantProgress: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/participant-progress`),

  createActionItem: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/actions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateActionItem: (learnerId, actionId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateOwnActionItem: (learnerId, actionId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/my-actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  createCounsellingSession: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCounsellingSession: (learnerId, sessionId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  createIntervention: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/interventions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateIntervention: (learnerId, interventionId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/interventions/${interventionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  escalateCase: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Phase 3 — Student-initiated selection ──────────────────────────────
  submitStudentSelection: (learnerId, payload) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/selection`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ── Decision Plan lifecycle ────────────────────────────────────────────
  getDecisionPlan: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/decision-plan`),

  submitDecisionPlan: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/decision-plan/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reviewDecisionPlanAsParent: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/decision-plan/parent-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reviewDecisionPlanAsCounsellor: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/decision-plan/counsellor-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveDecisionPlan: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/decision-plan/approve`, {
      method: 'POST',
    }),

  lockDecisionPlan: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/decision-plan/lock`, {
      method: 'POST',
    }),

  // ── Phase 4 — Senior school catalogue ──────────────────────────────────
  searchSeniorSchools: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return fetchWithAuth(`/pathway-planner/senior-schools${qs ? `?${qs}` : ''}`);
  },

  upsertSeniorSchool: (data) =>
    fetchWithAuth('/pathway-planner/senior-schools', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Phase 4 — School catalogue seed (super-admin) ──────────────────────
  seedSeniorSchools: () =>
    fetchWithAuth('/pathway-planner/seed-schools', { method: 'POST' }),

  // ── Phase 4 — School preferences ───────────────────────────────────────
  getSchoolPreferences: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/school-preferences`),

  saveSchoolPreferences: (learnerId, preferences) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/school-preferences`, {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),

  // ── Phase 4 — Family preferences ───────────────────────────────────────────
  getFamilyPreferences: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/family-preferences`),

  saveFamilyPreferences: (learnerId, data) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/family-preferences`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getSchoolMatches: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/school-matches`),

  recalculateSchoolMatches: (learnerId) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/school-matches/recalculate`, { method: 'POST' }),

  compareSchoolMatches: (learnerId, schoolIds) =>
    fetchWithAuth(`/pathway-planner/learners/${learnerId}/school-matches/compare?schoolIds=${encodeURIComponent(schoolIds.join(','))}`),

  submitSchoolCorrection: (schoolId, data) =>
    fetchWithAuth(`/pathway-planner/senior-schools/${schoolId}/corrections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSchoolCorrections: (status = '') =>
    fetchWithAuth(`/pathway-planner/admin/school-corrections${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  reviewSchoolCorrection: (correctionId, data) =>
    fetchWithAuth(`/pathway-planner/admin/school-corrections/${correctionId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifySeniorSchool: (schoolId, verificationStatus) =>
    fetchWithAuth(`/pathway-planner/senior-schools/${schoolId}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus }),
    }),
};
