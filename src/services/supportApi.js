
import axiosInstance from './api/axiosConfig';
import { getAuthItem } from '../utils/authStorage';

export const supportAPI = {
    getTickets: async () => {
        const response = await axiosInstance.get('/support');
        return response.data;
    },

    getTicket: async (id) => {
        const response = await axiosInstance.get(`/support/${id}`);
        return response.data;
    },

    createTicket: async (data) => {
        // If guest (no token), use public endpoint
        // Check if token exists or if we passed isGuest flag (implicit via data fields maybe?)
        // Let's assume axios interceptor handles auth. If we want public, we must use public URL.
        const token = getAuthItem('token');
        const url = token ? '/support' : '/onboarding/support';

        // If public, we need CSRF token first (handled by axiosInstance automatically? No, only requests. 
        // Our api.js has explicit getCsrf. But axiosInstance might not auto-attach it if not fetching it.
        // Let's rely on standard flow. If guest, we might need to fetch CSRF manually or ensure cookie is set.
        // Actually api.js -> authAPI.getCsrf().

        // For simplicity, let's assume if url is /onboarding/support, we might need to fetch csrf first if strict.
        // The backend `requireCsrf` middleware checks header `X-CSRF-Token`.
        // Let's fetch it if guest.

        let config = {};
        if (!token) {
            // We can't use authAPI here easily if circular dep, but let's try direct axios.
            // Or assume axiosInstance has cookie support? 
            // Best to just try. If fail, we improve.
            try {
                const csrfResp = await axiosInstance.get('/auth/csrf');
                config.headers = { 'X-CSRF-Token': csrfResp.data.token };
            } catch (e) { console.warn("CSRF fetch failed", e); }
        }

        const response = await axiosInstance.post(url, data, config);
        return response.data;
    },

    addMessage: async (id, message) => {
        const response = await axiosInstance.post(`/support/${id}/messages`, { message });
        return response.data;
    },

    updateTicket: async (id, data) => {
        const response = await axiosInstance.patch(`/support/${id}`, data);
        return response.data;
    }
};
