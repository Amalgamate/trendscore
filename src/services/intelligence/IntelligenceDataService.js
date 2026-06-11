import { dashboardAPI } from '../api/dashboard.api';

const CACHE_TTL_MS = 5 * 60 * 1000;

class IntelligenceDataService {
  constructor() {
    this._cachedSummary = null;
    this._cachedAt = 0;
    this._pendingRequest = null;
  }

  async fetchSummary(forceRefresh = false) {
    const cacheAge = Date.now() - this._cachedAt;
    if (!forceRefresh && this._cachedSummary && cacheAge < CACHE_TTL_MS) {
      return this._cachedSummary;
    }

    if (this._pendingRequest) {
      return this._pendingRequest;
    }

    this._pendingRequest = dashboardAPI
      .getIntelligenceSummary()
      .then((summary) => {
        const normalizedSummary = summary || {};
        this._cachedSummary = normalizedSummary;
        this._cachedAt = Date.now();
        return normalizedSummary;
      })
      .finally(() => {
        this._pendingRequest = null;
      });

    return this._pendingRequest;
  }

  clearCache() {
    this._cachedSummary = null;
    this._cachedAt = 0;
    this._pendingRequest = null;
  }
}

export const intelligenceDataService = new IntelligenceDataService();
