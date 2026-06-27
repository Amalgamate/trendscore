import { fetchWithAuth } from './core';

export const facilityAPI = {
  getStreamsByBranch: async () => fetchWithAuth('/facility/streams'),
  getStream: async (streamId) => fetchWithAuth(`/facility/streams/${streamId}`),
  createStream: async (data) =>
    fetchWithAuth('/facility/streams', { method: 'POST', body: JSON.stringify(data) }),
  updateStream: async (id, data) =>
    fetchWithAuth(`/facility/streams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStream: async (id) =>
    fetchWithAuth(`/facility/streams/${id}`, { method: 'DELETE' }),
  getAvailableStreamNames: async () => fetchWithAuth('/facility/streams/available'),
};
