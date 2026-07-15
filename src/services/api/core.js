import axiosInstance, { API_BASE_URL } from './axiosConfig';
import { cachedFetch, cacheDel, cacheDelPrefix, dedupe, TTL } from './apiCache';

export { API_BASE_URL, cachedFetch, cacheDel, cacheDelPrefix, dedupe, TTL };

const CSRF_HEADER = 'X-CSRF-Token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfToken = null;
let csrfTokenRequest = null;

const getCsrfToken = async (forceRefresh = false) => {
  if (forceRefresh) csrfToken = null;
  if (csrfToken) return csrfToken;
  if (!csrfTokenRequest) {
    csrfTokenRequest = axiosInstance.get('/auth/csrf')
      .then((response) => {
        const token = response?.data?.token;
        if (!token) throw new Error('Unable to obtain a CSRF token');
        csrfToken = token;
        return token;
      })
      .finally(() => { csrfTokenRequest = null; });
  }
  return csrfTokenRequest;
};

/**
 * Helper function to make authenticated requests using Axios
 */
export const fetchWithAuth = async (url, options = {}) => {
  try {
    let requestData = options.data;
    if (options.body) {
      if (options.body instanceof FormData) {
        requestData = options.body;
      } else if (typeof options.body === 'string') {
        try { requestData = JSON.parse(options.body); } catch (e) { requestData = options.body; }
      } else {
        requestData = options.body;
      }
    }

    const method = String(options.method || 'GET').toUpperCase();
    const headers = { ...options.headers };
    if (MUTATING_METHODS.has(method) && !headers[CSRF_HEADER]) {
      headers[CSRF_HEADER] = await getCsrfToken();
    }

    const config = {
      url,
      method,
      data: requestData,
      headers,
      params: options.params,
      onUploadProgress: options.onUploadProgress,
    };

    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

            const response = await axiosInstance(config);
            return response.data;
  } catch (error) {
    const isCsrfFailure = error.response?.status === 403 &&
      error.response?.data?.message === 'Invalid CSRF token';
    if (isCsrfFailure && !options._csrfRetried) {
      await getCsrfToken(true);
      const retryHeaders = { ...options.headers };
      delete retryHeaders[CSRF_HEADER];
      return fetchWithAuth(url, { ...options, headers: retryHeaders, _csrfRetried: true });
    }
    if (error.response?.data) {
      const data = error.response.data;
      let msg = data.message;
      if (!msg && data.error) {
        if (typeof data.error === 'object') {
          msg = data.error.message || JSON.stringify(data.error);
        } else {
          msg = data.error;
        }
      }
      msg = msg || `HTTP ${error.response.status}`;
      throw new Error(msg);
    }
    throw error;
  }
};

export const clearApiCache = (key) => {
  if (key) { cacheDel(key); }
  else { cacheDelPrefix(''); }
};
