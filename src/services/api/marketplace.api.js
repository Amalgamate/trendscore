import { fetchWithAuth } from './core';

/**
 * Marketplace API client
 * Handles all marketplace endpoints for listing management, browsing, and purchases
 *
 * Server mount point: /api/lms/marketplace/*  (server/src/routes/lms.routes.ts)
 * Gated behind requireApp('lms-enterprise') — schools without that app enabled
 * will receive a 403; callers should treat that as "marketplace not available"
 * rather than a hard error.
 */
export const marketplaceAPI = {
  // ─── Browse & Details ──────────────────────────────────────────────────────
  // Server route is GET /lms/marketplace (there is no /browse suffix)
  browseListings: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/lms/marketplace${queryString ? `?${queryString}` : ''}`);
  },

  getListingDetail: async (id) =>
    fetchWithAuth(`/lms/marketplace/${id}`),

  // ─── Create & Manage Listings (Seller) ─────────────────────────────────────
  createListing: async (data) =>
    fetchWithAuth('/lms/marketplace', { method: 'POST', body: JSON.stringify(data) }),

  updateListing: async (id, data) =>
    fetchWithAuth(`/lms/marketplace/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getMyListings: async () =>
    fetchWithAuth('/lms/marketplace/my-listings'),

  // ─── Approval (Admin) ──────────────────────────────────────────────────────
  approveListing: async (id) =>
    fetchWithAuth(`/lms/marketplace/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),

  rejectListing: async (id, reason) =>
    fetchWithAuth(`/lms/marketplace/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // ─── Purchases (Buyer) ─────────────────────────────────────────────────────
  initiatePurchase: async (listingId, phone, firstName, lastName) =>
    fetchWithAuth(`/lms/marketplace/${listingId}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ phone, firstName, lastName }),
    }),

  getMyPurchases: async () =>
    fetchWithAuth('/lms/marketplace/my-purchases'),

  downloadPurchasedResource: async (purchaseId) =>
    fetchWithAuth(`/lms/marketplace/purchases/${purchaseId}/download`, { method: 'POST' }),

  // Server route is POST /lms/marketplace/:id/rate — :id is the LISTING id, not the purchase id
  rateResource: async (listingId, rating) =>
    fetchWithAuth(`/lms/marketplace/${listingId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),

  // ─── Analytics ────────────────────────────────────────────────────────────
  getMarketplaceAnalytics: async () =>
    fetchWithAuth('/lms/analytics/marketplace'),
};
