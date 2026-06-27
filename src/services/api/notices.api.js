import { fetchWithAuth } from './core';
import { qs, resourceApi } from './factory';

export const noticesAPI = {
  ...resourceApi('/notices'),
};
