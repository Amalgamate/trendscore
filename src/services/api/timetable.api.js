import { fetchWithAuth } from './core';

export const timetableAPI = {
  getFoundation: () => fetchWithAuth('/timetable/foundation'),
  createBellSchedule: (data) => fetchWithAuth('/timetable/bell-schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateBellSchedule: (bellScheduleId, data) => fetchWithAuth(`/timetable/bell-schedules/${bellScheduleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateBellPeriod: (periodId, data) => fetchWithAuth(`/timetable/bell-schedules/periods/${periodId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createRoom: (data) => fetchWithAuth('/timetable/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (roomId, data) => fetchWithAuth(`/timetable/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  saveAllocation: (data) => fetchWithAuth('/timetable/instructional-allocations', { method: 'PUT', body: JSON.stringify(data) }),
  saveTeacherAvailability: (data) => fetchWithAuth('/timetable/teacher-availability', { method: 'PUT', body: JSON.stringify(data) }),
  createPlan: (data) => fetchWithAuth('/timetable/plans', { method: 'POST', body: JSON.stringify(data) }),
  listVersions: (planId) => fetchWithAuth(`/timetable/plans/${planId}/versions`),
  getEntries: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/entries`),
  replaceEntries: (versionId, entries) => fetchWithAuth(`/timetable/versions/${versionId}/entries`, { method: 'PUT', body: JSON.stringify({ entries }) }),
  updateEntry: (versionId, entryId, data) => fetchWithAuth(`/timetable/versions/${versionId}/entries/${entryId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getConflicts: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/conflicts`),
  getAnalytics: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/analytics`),
  transition: (versionId, status) => fetchWithAuth(`/timetable/versions/${versionId}/transition`, { method: 'POST', body: JSON.stringify({ status }) }),
  cloneVersion: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/clone`, { method: 'POST' }),
  generate: (versionId, options = {}) => fetchWithAuth(`/timetable/versions/${versionId}/generate`, { method: 'POST', body: JSON.stringify(options) }),
  publish: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/publish`, { method: 'POST' }),
  getOverrideCount: (versionId) => fetchWithAuth(`/timetable/versions/${versionId}/override-count`),
};
