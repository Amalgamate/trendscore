import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { schoolAPI } from '../services/api';

const ModuleAccessContext = createContext({
  modules: [],
  activeSlugs: [],
  loading: false,
  refreshModules: async () => {},
  isModuleEnabled: () => true,
});

export const ModuleAccessProvider = ({ user, children }) => {
  const [modules, setModules] = useState([]);
  const [activeSlugs, setActiveSlugs] = useState([]);
  const [packages, setPackages] = useState({});
  const [loading, setLoading] = useState(false);

  const refreshModules = useCallback(async () => {
    if (!user) {
      setModules([]);
      setActiveSlugs([]);
      setPackages({});
      return null;
    }

    setLoading(true);
    try {
      const response = await schoolAPI.getModules();
      const data = response?.data || response;
      setModules(data?.modules || []);
      setActiveSlugs(data?.activeSlugs || []);
      setPackages(data?.packages || {});
      return data;
    } catch (error) {
      console.warn('[ModuleAccess] Failed to load module config; keeping modules open.', error);
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
      if (!modules.length) return true;
      return activeSet.has(slug);
    },
  }), [activeSet, activeSlugs, loading, modules, packages, refreshModules]);

  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  );
};

export const useModuleAccess = () => useContext(ModuleAccessContext);

