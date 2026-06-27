import { fetchWithAuth } from './core';
import { resourceApi } from './factory';

export const idTemplateAPI = {
  ...resourceApi('/id-templates'),
  getActive: async () => fetchWithAuth('/id-templates/active'),
};
