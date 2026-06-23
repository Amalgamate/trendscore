import axiosInstance, { API_BASE_URL } from './axiosConfig';
import { cachedFetch, cacheDel, cacheDelPrefix, dedupe, TTL } from './apiCache';

export { API_BASE_URL, cachedFetch, cacheDel, cacheDelPrefix, dedupe, TTL };

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

    const config = {
      url,
      method: options.method || 'GET',
      data: requestData,
      headers: { ...options.headers },
      params: options.params,
      onUploadProgress: options.onUploadProgress,
    };

    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

            const response = await axiosInstance(config);
            return response.data;
  } catch (error) {
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

