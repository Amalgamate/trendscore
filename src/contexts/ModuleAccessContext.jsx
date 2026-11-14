import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { schoolAPI } from '../services/api';

const ModuleAccessContext = createContext({
  modules: [],
  activeSlugs: [],
  loading: false,
  refreshModules: async () => {},
  isModuleEnabled: () => false,
});

export const ModuleAccessProvider = ({ user, children }) => {
  const [modules, setModules] = useState([]);
  const [activeSlugs, setActiveSlugs] = useState([]);
  const [packages, setPackages] = useState({});
  const [loading, setLoading] = useState(Boolean(user));

  const refreshModules = useCallback(async () => {
    if (!user) {
      setModules([]);
      setActiveSlugs([]);
      setPackages({});
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const response = await schoolAPI.getModules();
      const data = response?.data?.data || response?.data || response;
      setModules(Array.isArray(data?.modules) ? data.modules : []);
      setActiveSlugs(Array.isArray(data?.activeSlugs) ? data.activeSlugs : []);
      setPackages(data?.packages || {});
      return data;
    } catch (error) {
      console.warn('[ModuleAccess] Failed to load module config; module access is disabled.', error);
      setModules([]);
      setActiveSlugs([]);
      setPackages({});
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshModules();
  }, [refreshModules]);

  const activeSet = useMemo(() => new Set(activeSlugs), [activeSlugs]);

  const value = useMemo(() => ({
    modules,
    activeSlugs,
    packages,
    loading,
    refreshModules,
    isModuleEnabled: (slug) => {
      if (!slug) return true;
      if (activeSet.has(slug)) return true;
      if (slug === 'lms-professional') return activeSet.has('lms');
      return false;
    },
  }), [activeSet, activeSlugs, loading, modules, packages, refreshModules]);

  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  );
};

export const useModuleAccess = () => useContext(ModuleAccessContext);
