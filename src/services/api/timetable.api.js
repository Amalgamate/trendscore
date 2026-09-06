import { fetchWithAuth } from './core';

export const timetableAPI = {
  getFoundation: () => fetchWithAuth('/timetable/foundation'),
  createBellSchedule: (data) => fetchWithAuth('/timetable/bell-schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateBellSchedule: (bellScheduleId, data) => fetchWithAuth(`/timetable/bell-schedules/${bellScheduleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBellSchedule: (bellScheduleId) => fetchWithAuth(`/timetable/bell-schedules/${bellScheduleId}`, { method: 'DELETE' }),
  updateBellPeriod: (periodId, data, cascade = true) => fetchWithAuth(`/timetable/bell-schedules/periods/${periodId}${cascade ? '' : '?cascade=false'}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createRoom: (data) => fetchWithAuth('/timetable/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (roomId, data) => fetchWithAuth(`/timetable/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoom: (roomId) => fetchWithAuth(`/timetable/rooms/${roomId}`, { method: 'DELETE' }),
  saveAllocation: (data) => fetchWithAuth('/timetable/instructional-allocations', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAllocation: (allocationId) => fetchWithAuth(`/timetable/instructional-allocations/${allocationId}`, { method: 'DELETE' }),
  clearAllocations: (filters) => fetchWithAuth(`/timetable/instructional-allocations${filters ? `?${new URLSearchParams(filters)}` : ''}`, { method: 'DELETE' }),
  saveTeacherAvailability: (data) => fetchWithAuth('/timetable/teacher-availability', { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeacherAvailability: (availabilityId) => fetchWithAuth(`/timetable/teacher-availability/${availabilityId}`, { method: 'DELETE' }),
  masterReset: (options) => fetchWithAuth('/timetable/master-reset', { method: 'POST', body: JSON.stringify(options || {}) }),
  createPlan: (data) => fetchWithAuth('/timetable/plans', { method: 'POST', body: JSON.stringify(data) }),
  deletePlan: (planId) => fetchWithAuth(`/timetable/plans/${planId}`, { method: 'DELETE' }),
  listVersions: (planId) => fetchWithAuth(`/timetable/plans/${planId}/versions`),
  getEntries: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/entries`),
  replaceEntries: (versionId, entries) => fetchWithAuth(`/timetable/versions/${versionId}/entries`, { method: 'PUT', body: JSON.stringify({ entries }) }),
  updateEntry: (versionId, entryId, data) => fetchWithAuth(`/timetable/versions/${versionId}/entries/${entryId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getConflicts: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/conflicts`),
  getAnalytics: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/analytics`),
  transition: (versionId, status) => fetchWithAuth(`/timetable/versions/${versionId}/transition`, { method: 'POST', body: JSON.stringify({ status }) }),
  cloneVersion: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/clone`, { method: 'POST' }),
  generate: (versionId, options = {}) => fetchWithAuth(`/timetable/versions/${versionId}/generate`, { method: 'POST', body: JSON.stringify(options) }),
  resetVersion: (versionId, clearLocked = true) => fetchWithAuth(`/timetable/versions/${versionId}/reset`, { method: 'POST', body: JSON.stringify({ clearLocked }) }),
  publish: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/publish`, { method: 'POST' }),
  getOverrideCount: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/override-count`),
  getGapAnalysis: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/gap-analysis`),
  resetLiveSchedule: (academicYear, term) => fetchWithAuth('/timetable/reset-live', { method: 'POST', body: JSON.stringify({ academicYear, term }) }),
  createChangeRequest: (data) => fetchWithAuth('/timetable/change-requests', { method: 'POST', body: JSON.stringify(data) }),
  listChangeRequests: (status, { take, cursor } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (take) params.set('take', String(take));
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return fetchWithAuth(`/timetable/change-requests${qs ? `?${qs}` : ''}`);
  },
  approveChangeRequest: (requestId, reviewNote) => fetchWithAuth(`/timetable/change-requests/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ reviewNote }) }),
  rejectChangeRequest: (requestId, reviewNote) => fetchWithAuth(`/timetable/change-requests/${requestId}/reject`, { method: 'POST', body: JSON.stringify({ reviewNote }) }),
};
