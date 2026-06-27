import { fetchWithAuth } from './core';
import { qs } from './factory';

export const systemLogsAPI = {
  getLogs: async (params = {}) =>
    fetchWithAuth(`/settings/system-logs${qs(params)}`),
};
