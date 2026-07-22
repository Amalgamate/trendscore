/**
 * Authentication Context
 * Provides authentication state and user information throughout the app
 * 
 * @module contexts/AuthContext
 */

import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { setInstitutionType } from '../services/api/institutionContext';
import { useBootstrapStore } from '../store/useBootstrapStore';
import { resetMobileOnboardingForLogout } from '../utils/mobileOnboardingStorage';
import { clearAuthStorage, getAuthItem, setAuthItem, storeAuthSession } from '../utils/authStorage';

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  institutionType: 'PRIMARY_CBC',
  login: () => { },
  logout: () => { },
  updateUser: () => { },
});

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevInstitutionTypeRef = useRef(null);

  const normalizeUser = useCallback((u) => {
    if (!u) return u;
    // Don't force PRIMARY_CBC default when the backend has signalled that institution
    // setup is still required (post-reset). The wizard will lock the type and then
    // call updateUser() to patch this value in memory.
    const institutionType = u.requiresInstitutionSetup
      ? (u.institutionType ?? null)
      : (u.institutionType || 'PRIMARY_CBC');
    try {
      localStorage.removeItem('selectedInstitutionType');
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
    return { ...u, institutionType };
  }, []);

  // Keep the axios interceptor and bootstrap cache in sync whenever user changes
  useEffect(() => {
    const type = user?.institutionType || 'PRIMARY_CBC';
    setInstitutionType(type);

    // If the institution type changed mid-session, wipe the bootstrap cache so
    // stale scoped data (learners, classes, subjects) never bleeds into the new context.
    if (
      prevInstitutionTypeRef.current !== null &&
      prevInstitutionTypeRef.current !== type
    ) {
      useBootstrapStore.getState().clear();
    }
    prevInstitutionTypeRef.current = type;
  }, [user?.institutionType]);

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = getAuthItem('token');
        const storedUser = getAuthItem('user');

        // Support both real tokens and cookie-based placeholders
        if (storedUser && (token || document.cookie.includes('accessToken'))) {
          const parsedUser = normalizeUser(JSON.parse(storedUser));
          setAuthItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
        // Clear invalid data
        clearAuthStorage();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [normalizeUser]);

  const login = useCallback((userData, token, refreshToken, options = {}) => {
    try {
      const normalizedUser = normalizeUser(userData);

      storeAuthSession({
        token,
        refreshToken,
        user: normalizedUser,
        rememberMe: options.rememberMe === true,
      });

      setUser(normalizedUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }, [normalizeUser]);

  const logout = useCallback(() => {
    resetMobileOnboardingForLogout();

    // Clear localStorage
    clearAuthStorage();
    localStorage.removeItem('selectedInstitutionType');

    // Expire HttpOnly cookies (server will honour these on next request,
    // but clearing them client-side removes them from browser storage immediately)
    document.cookie = 'accessToken=; Max-Age=0; path=/; SameSite=Lax';
    document.cookie = 'refreshToken=; Max-Age=0; path=/; SameSite=Lax';

    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prevUser => {
      const updatedUser = { ...prevUser, ...updates };
      setAuthItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const value = React.useMemo(() => ({
    isAuthenticated,
    user,
    loading,
    institutionType: user?.institutionType || 'PRIMARY_CBC',
    login,
    logout,
    updateUser,
  }), [isAuthenticated, user, loading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
