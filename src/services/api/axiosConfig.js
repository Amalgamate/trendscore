import axios from 'axios';
import { getInstitutionType } from './institutionContext';
import { clearAuthAndRedirect, getAuthErrorCode } from '../../utils/sessionLifecycle';
import { getAuthItem, getImpersonationAccessToken, hasImpersonationSession, setAuthItem } from '../../utils/authStorage';

// Use environment variable for API URL or fall back to automatic discovery for production stability
const getApiBaseUrl = () => {
    // 1. Check for explicit environment variables (Vite standard)
    const viteApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
    if (viteApiUrl) return viteApiUrl;

    // 2. Deployed web app: same-origin /api (reverse proxy)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return `${window.location.origin}/api`;
    }

    // 3. Local Vite dev: use same-origin /api so requests go through Vite's
    // HTTPS proxy → http://localhost:5000. This avoids mixed-content blocks
    // (HTTPS page → HTTP API) when the dev server runs with https:true.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return '/api';
    }

    return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {},
    withCredentials: true,
    timeout: 60_000,
});

// ── Request interceptor ───────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
    (config) => {
        // Preference for cookies (withCredentials: true), 
        // but allow Bearer fallback for mobile/capacitor clients
        const impersonationToken = getImpersonationAccessToken();
        const impersonating = hasImpersonationSession();
        const token = impersonationToken || getAuthItem('token');
        // During impersonation, never let a stale admin bearer token override
        // the short-lived impersonation cookie. New sessions carry the explicit
        // impersonation token; existing sessions safely fall back to the cookie.
        if (impersonating && !impersonationToken) {
            // Axios may retain a header from a request created before the
            // impersonation swap. Authentication gives Bearer precedence over
            // cookies, so remove both casings and let the target-user cookie win.
            delete config.headers.Authorization;
            delete config.headers.authorization;
        } else if (token && token.startsWith('ey')) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        const institutionType = getInstitutionType();
        if (institutionType) {
            config.headers['x-institution-type'] = institutionType;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Refresh Queue Mechanism ───────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const isAuthenticationAttempt = (url = '') => [
    '/auth/login',
    '/auth/otp/request',
    '/auth/otp/verify',
    '/auth/phone-otp/request',
    '/auth/phone-otp/verify',
    '/auth/student-phone/lookup',
    '/auth/student-phone/login',
].some((path) => url.includes(path));

// ── Response interceptor ──────────────────────────────────────────────────────
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const errorCode = getAuthErrorCode(error);

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            if (errorCode === 'FORCE_LOGOUT') {
                _clearAuth('forced');
                return Promise.reject(error);
            }

            // If the failure was on the refresh or login endpoint itself, don't attempt refresh
            const requestUrl = originalRequest.url || '';
            if (isAuthenticationAttempt(requestUrl)) {
                return Promise.reject(error);
            }
            if (requestUrl.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return axiosInstance(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            // When using cookies, the browser handles sending the refreshToken automatically 
            // the withCredentials: true ensures it is sent. 
            // We still pass it as a body if available for compatibility.
            const refreshToken = getAuthItem('refreshToken');

            try {
                // withCredentials is inherited from axiosInstance settings
                const response = await axiosInstance.post(`/auth/refresh`, { refreshToken });
                if (response.status === 200) {
                    // If the server rotated cookies, the browser already has them.
                    // If the server also returned body tokens (legacy/mobile), update them.
                    const { token, refreshToken: newRefreshToken } = response.data || {};
                    if (token) setAuthItem('token', token);
                    if (newRefreshToken) setAuthItem('refreshToken', newRefreshToken);
                    
                    processQueue(null, token);
                    isRefreshing = false;
                    return axiosInstance(originalRequest);
                }
            } catch (_refreshError) {
                processQueue(_refreshError, null);
                isRefreshing = false;
                _clearAuth(getAuthErrorCode(_refreshError) === 'FORCE_LOGOUT' ? 'forced' : 'expired');
            }
        }
        return Promise.reject(error);
    }
);

function _clearAuth(reason = 'expired') {
    clearAuthAndRedirect(reason);
}

export default axiosInstance;
