/**
 * Transport Trips API
 * Covers /api/v1/transport/trips/* endpoints
 */
import { fetchWithAuth } from './core';

export const tripsAPI = {
  /** GET /api/v1/transport/trips?routeId=&date= */
  getTrips: (routeId, date) => {
    const params = new URLSearchParams({ routeId });
    if (date) params.set('date', date);
    return fetchWithAuth(`/v1/transport/trips?${params.toString()}`);
  },

  /** GET /api/v1/transport/trips/:tripId */
  getTripById: (tripId) =>
    fetchWithAuth(`/v1/transport/trips/${tripId}`),

  /** POST /api/v1/transport/trips — create or get existing trip */
  createOrGetTrip: (data) =>
    fetchWithAuth('/v1/transport/trips', { method: 'POST', body: JSON.stringify(data) }),

  /** PATCH /api/v1/transport/trips/:tripId/status */
  updateTripStatus: (tripId, data) =>
    fetchWithAuth(`/v1/transport/trips/${tripId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  /** GET /api/v1/transport/trips/:tripId/manifest */
  getManifest: (tripId) =>
    fetchWithAuth(`/v1/transport/trips/${tripId}/manifest`),

  /** POST /api/v1/transport/trips/:tripId/board — single boarding */
  recordBoarding: (tripId, data) =>
    fetchWithAuth(`/v1/transport/trips/${tripId}/board`, { method: 'POST', body: JSON.stringify(data) }),

  /** POST /api/v1/transport/trips/:tripId/board/bulk */
  bulkBoarding: (tripId, data) =>
    fetchWithAuth(`/v1/transport/trips/${tripId}/board/bulk`, { method: 'POST', body: JSON.stringify(data) }),
};
