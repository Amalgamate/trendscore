/**
 * factory.js
 *
 * Lightweight helpers that eliminate the most repetitive boilerplate in
 * API service modules.
 *
 * Usage:
 *   import { qs, resourceApi } from './factory';
 *
 *   // Simple query string — used by almost every "list" method
 *   fetchWithAuth(`/items${qs(params)}`)
 *
 *   // Full CRUD resource
 *   export const itemAPI = {
 *     ...resourceApi('/items', { cacheKeyPrefix: 'items:' }),
 *     // custom method
 *     archive: async (id) => fetchWithAuth(`/items/${id}/archive`, { method: 'POST' }),
 *   };
 */

import { fetchWithAuth, cachedFetch, cacheDelPrefix, TTL } from './core';

// ── Query string builder ─────────────────────────────────────────────────────
// Removes null/undefined/empty values before serialising. Used by ~25 modules.
export const qs = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const str = new URLSearchParams(clean).toString();
  return str ? `?${str}` : '';
};

// ── CRUD resource factory ────────────────────────────────────────────────────
// Generates the five standard REST methods for a resource at `basePath`.
// Callers can spread the result and override any method, or add custom ones.
//
// Options:
//   cacheKeyPrefix  — bust this prefix on mutations (e.g. 'items:')
//   listCacheTTL    — when set, wraps getAll in cachedFetch with this TTL
//
export const resourceApi = (basePath, opts = {}) => {
  const { cacheKeyPrefix, listCacheTTL } = opts;

  const invalidate = () => {
    if (cacheKeyPrefix) cacheDelPrefix(cacheKeyPrefix);
  };

  const buildListUrl = (params) => `${basePath}${qs(params)}`;

  return {
    /** GET /path?params */
    getAll: listCacheTTL
      ? (params = {}) => {
          const key = `${cacheKeyPrefix || ''}list:${qs(params) || 'all'}`;
          return cachedFetch(key, () => fetchWithAuth(buildListUrl(params)), listCacheTTL);
        }
      : (params = {}) => fetchWithAuth(buildListUrl(params)),

    /** GET /path/:id */
    getById: (id) => fetchWithAuth(`${basePath}/${id}`),

    /** POST /path */
    create: (data) => {
      invalidate();
      return fetchWithAuth(basePath, { method: 'POST', body: JSON.stringify(data) });
    },

    /** PUT /path/:id */
    update: (id, data) => {
      invalidate();
      return fetchWithAuth(`${basePath}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },

    /** DELETE /path/:id */
    delete: (id) => {
      invalidate();
      return fetchWithAuth(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
};

export default { qs, resourceApi };
