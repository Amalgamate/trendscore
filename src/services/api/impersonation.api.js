import { fetchWithAuth } from './core';

/**
 * Frontend types (mirrored from server/src/types/impersonation.types.ts)
 *
 * @typedef {Object} LinkedLearner
 * @property {string} admissionNumber
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} grade
 * @property {string|null} stream
 * @property {string|null} className
 *
 * @typedef {Object} ClassAsTeacher
 * @property {string} name
 * @property {string} grade
 *
 * @typedef {Object} UserSearchResult
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {string|null} phone
 * @property {string} role
 * @property {string|null} staffId
 * @property {string|null} profilePicture
 * @property {string} status - "ACTIVE" | "INACTIVE"
 * @property {LinkedLearner[]} linkedLearners
 * @property {ClassAsTeacher[]} classesAsTeacher
 *
 * @typedef {Object} ImpersonatedUserInfo
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} role
 *
 * @typedef {Object} ImpersonationStartResult
 * @property {string} accessToken
 * @property {ImpersonatedUserInfo} impersonatedUser
 * @property {string} originalAdminId
 * @property {string} expiresAt - ISO 8601 date string
 */

/**
 * Search users for impersonation.
 *
 * GET /api/admin/impersonate/search
 *
 * @param {string} query - Search term (name, email, phone, staffId, admissionNumber, role)
 * @param {number} [limit=10] - Maximum number of results (server enforces ≤ 10)
 * @returns {Promise<UserSearchResult[]>}
 */
export async function searchUsersForImpersonation(query, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetchWithAuth(`/admin/impersonate/search?${params.toString()}`);
  // The endpoint returns { success: true, data: UserSearchResult[] }
  return response.data ?? response;
}

/**
 * Start an impersonation session for the given target user.
 *
 * POST /api/admin/impersonate/start
 *
 * @param {string} targetUserId - The ID of the user to impersonate
 * @returns {Promise<ImpersonationStartResult>}
 */
export async function startImpersonationSession(targetUserId) {
  const response = await fetchWithAuth('/admin/impersonate/start', {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });
  // The endpoint returns the ImpersonationStartResult directly (or wrapped)
  return response.data ?? response;
}

/**
 * Stop the current impersonation session.
 * The impersonation token is read from the request cookie automatically
 * (withCredentials: true on the shared axios instance).
 *
 * POST /api/admin/impersonate/stop
 *
 * @returns {Promise<void>}
 */
export async function stopImpersonationSession() {
  await fetchWithAuth('/admin/impersonate/stop', { method: 'POST' });
}

/**
 * Named object export — mirrors the pattern used by other API modules
 * (e.g. transportAPI, userAPI) for consistent import style across the codebase.
 */
export const impersonationApi = {
  searchUsers: searchUsersForImpersonation,
  startSession: startImpersonationSession,
  stopSession: stopImpersonationSession,
};

export default impersonationApi;
