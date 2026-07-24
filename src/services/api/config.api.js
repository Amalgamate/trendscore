import { fetchWithAuth, cachedFetch, cacheDel, cacheDelPrefix, TTL } from './core';
import axiosInstance from './axiosConfig';
import { getSelectedInstitutionType } from '../schoolContext';

const institutionCacheKeySuffix = () => {
  try {
    const selected = String(getSelectedInstitutionType() || '').toUpperCase();
    if (selected) return selected;
    const raw = localStorage.getItem('user');
    if (!raw) return 'PRIMARY_CBC';
    const u = JSON.parse(raw);
    return u?.institutionType || 'PRIMARY_CBC';
  } catch {
    return 'PRIMARY_CBC';
  }
};

export const configAPI = {
  getTermConfigs: async () =>
    cachedFetch('config:terms', () => fetchWithAuth('/config/term'), TTL.LONG),
  getActiveTermConfig: async () => fetchWithAuth('/config/term/active'),
  upsertTermConfig: async (data) => {
    cacheDel('config:terms');
    return fetchWithAuth('/config/term', { method: 'POST', body: JSON.stringify(data) });
  },
  updateTermConfig: async (id, data) => {
    cacheDel('config:terms');
    return fetchWithAuth(`/config/term/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  getAggregationConfigs: async () => cachedFetch('config:aggregation', () => fetchWithAuth('/config/aggregation'), TTL.LONG),
  createAggregationConfig: async (data) =>
    fetchWithAuth('/config/aggregation', { method: 'POST', body: JSON.stringify(data) }),
  updateAggregationConfig: async (id, data) =>
    fetchWithAuth(`/config/aggregation/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAggregationConfig: async (id) =>
    fetchWithAuth(`/config/aggregation/${id}`, { method: 'DELETE' }),

  getStreamConfigs: async () =>
    cachedFetch('config:streams', () => fetchWithAuth('/config/streams'), TTL.LONG),
  upsertStreamConfig: async (data) => {
    cacheDel('config:streams');
    return fetchWithAuth('/config/streams', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteStreamConfig: async (id) => {
    cacheDel('config:streams');
    return fetchWithAuth(`/config/streams/${id}`, { method: 'DELETE' });
  },

  getGrades: async () => {
    const suffix = institutionCacheKeySuffix();
    return cachedFetch(`config:grades:${suffix}`, () => fetchWithAuth('/config/grades'), TTL.VERY_LONG);
  },

  getBranding: async () => fetchWithAuth('/schools/public/branding'),

  getLearningAreas: async (params = {}, options = {}) => {
    const suffix = institutionCacheKeySuffix();
    const query = new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [k, v]) => {
        if (v === undefined || v === null || v === '') return acc;
        acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    const path = `/learning-areas${query ? `?${query}` : ''}`;
    const cacheKey = `config:learning-areas:${suffix}:${query || 'all'}`;
    if (options?.fresh) {
      cacheDel(cacheKey);
      return fetchWithAuth(path);
    }
    return cachedFetch(cacheKey, () => fetchWithAuth(path), TTL.LONG);
  },
  getLearningArea: async (id) => fetchWithAuth(`/learning-areas/${id}`),
  createLearningArea: async (data) => {
    cacheDelPrefix('config:learning-areas:');
    return fetchWithAuth('/learning-areas', { method: 'POST', body: JSON.stringify(data) });
  },
  updateLearningArea: async (id, data) => {
    cacheDelPrefix('config:learning-areas:');
    return fetchWithAuth(`/learning-areas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteLearningArea: async (id) => {
    cacheDelPrefix('config:learning-areas:');
    return fetchWithAuth(`/learning-areas/${id}`, { method: 'DELETE' });
  },
  seedLearningAreas: async () => {
    cacheDelPrefix('config:learning-areas:');
    return fetchWithAuth('/learning-areas/seed/default', { method: 'POST' });
  },
  seedPathways: async () => fetchWithAuth('/pathways/seed', { method: 'POST' }),

  seedClasses: async () => fetchWithAuth('/config/classes/seed', { method: 'POST' }),
  seedStreams: async () => {
    cacheDel('config:streams');
    return fetchWithAuth('/config/streams/seed', { method: 'POST' });
  },

  getClasses: async () => {
    const suffix = institutionCacheKeySuffix();
    return cachedFetch(
      `config:classes:${suffix}`,
      () => fetchWithAuth('/config/classes'),
      TTL.LONG,
    );
  },
  upsertClass: async (data) => {
    cacheDelPrefix('config:classes:');
    return fetchWithAuth('/config/classes', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteClass: async (id) => {
    cacheDelPrefix('config:classes:');
    return fetchWithAuth(`/config/classes/${id}`, { method: 'DELETE' });
  },

  /**
   * Load LMS builder choices independently. A failure in an optional lookup
   * must never discard classes or subjects that loaded successfully.
   */
  getLmsFormOptions: async () => {
    const lookups = {
      classes: configAPI.getClasses(),
      learningAreas: configAPI.getLearningAreas(),
      terms: configAPI.getTermConfigs(),
      streams: configAPI.getStreamConfigs(),
    };
    const keys = Object.keys(lookups);
    const settled = await Promise.allSettled(Object.values(lookups));
    const options = {};
    const failed = [];

    settled.forEach((result, index) => {
      const key = keys[index];
      if (result.status === 'fulfilled') {
        const response = result.value;
        options[key] = response?.data || response || [];
      } else {
        options[key] = [];
        failed.push(key);
      }
    });

    return { options, failed };
  },
};
