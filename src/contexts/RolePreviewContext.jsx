/**
 * Role Preview Context
 * Allows SUPER_ADMIN users to preview the system as any role without changing their actual authentication
 * 
 * Security Note:
 * Preview role affects frontend rendering only. Backend authorization remains based on authenticated SUPER_ADMIN session.
 * The actual user object and authentication token are never modified. This is a "View As" feature for testing only.
 * 
 * @module contexts/RolePreviewContext
 */

import React, { createContext, useCallback, useEffect, useState } from 'react';

export const RolePreviewContext = createContext({
  realRole: null,
  effectiveRole: null,
  previewRole: null,
  isPreviewingRole: false,
  setPreviewRole: () => {},
  resetPreviewRole: () => {},
});

const PREVIEW_ROLE_STORAGE_KEY = 'trendscore_preview_role';

// All available roles for super admin preview
export const PREVIEW_AVAILABLE_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'PARENT',
  'STUDENT',
];

export const RolePreviewProvider = ({ children, user }) => {
  const [previewRole, setPreviewRoleState] = useState(null);
  
  // Get real role from authenticated user
  const realRole = user?.role || null;
  
  // Only SUPER_ADMIN can use preview mode
  const canUsePreview = realRole === 'SUPER_ADMIN';

  // Restore preview role from localStorage on mount
  useEffect(() => {
    if (!canUsePreview) {
      // Clear preview if user is no longer SUPER_ADMIN (e.g., after logout/role change)
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear preview role from localStorage:', e);
      }
      return;
    }

    try {
      const savedPreviewRole = localStorage.getItem(PREVIEW_ROLE_STORAGE_KEY);
      if (savedPreviewRole && PREVIEW_AVAILABLE_ROLES.includes(savedPreviewRole)) {
        setPreviewRoleState(savedPreviewRole);
      } else {
        // Clear invalid preview role
        localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to restore preview role from localStorage:', e);
    }
  }, [canUsePreview, realRole]);

  /**
   * Set preview role (only for SUPER_ADMIN)
   * Persists to localStorage for session continuity
   */
  const setPreviewRole = useCallback((role) => {
    if (!canUsePreview) {
      console.warn('Only SUPER_ADMIN can preview roles');
      return;
    }

    if (!PREVIEW_AVAILABLE_ROLES.includes(role)) {
      console.warn(`Invalid preview role: ${role}`);
      return;
    }

    setPreviewRoleState(role);
    try {
      localStorage.setItem(PREVIEW_ROLE_STORAGE_KEY, role);
    } catch (e) {
      console.warn('Failed to persist preview role to localStorage:', e);
    }
  }, [canUsePreview]);

  /**
   * Reset preview role back to SUPER_ADMIN
   */
  const resetPreviewRole = useCallback(() => {
    setPreviewRoleState(null);
    try {
      localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear preview role from localStorage:', e);
    }
  }, []);

  /**
   * Calculate effective role for UI rendering
   * Rules:
   * - If not SUPER_ADMIN, always use realRole (no preview allowed)
   * - If SUPER_ADMIN and previewRole is set, use previewRole
   * - If SUPER_ADMIN and no previewRole, use SUPER_ADMIN (realRole)
   */
  const effectiveRole = (() => {
    if (!canUsePreview) {
      return realRole; // Non-SUPER_ADMIN always uses their real role
    }
    return previewRole || realRole; // SUPER_ADMIN uses preview if set, otherwise real role
  })();

  const isPreviewingRole = canUsePreview && previewRole !== null && previewRole !== realRole;

  const value = {
    realRole,
    effectiveRole,
    previewRole,
    isPreviewingRole,
    setPreviewRole,
    resetPreviewRole,
  };

  return (
    <RolePreviewContext.Provider value={value}>
      {children}
    </RolePreviewContext.Provider>
  );
};

/**
 * Hook to use role preview context
 */
export const useRolePreview = () => {
  const context = React.useContext(RolePreviewContext);
  if (!context) {
    throw new Error('useRolePreview must be used within RolePreviewProvider');
  }
  return context;
};
