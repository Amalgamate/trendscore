/**
 * usePermissions Hook
 * Provides permission checking functionality based on user role
 * Supports role preview mode for SUPER_ADMIN users
 * 
 * Security Note:
 * When in preview mode, this hook uses effectiveRole for frontend rendering.
 * Backend authorization always uses the real authenticated user role.
 * 
 * @module hooks/usePermissions
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useRolePreview } from '../contexts/RolePreviewContext';
import {
  hasPermission,
  hasAnyPermission,
  canManageRole,
  getRolePermissions,
  ROLE_HIERARCHY,
  ROLES,
} from '../config/permissions';

export const usePermissions = () => {
  const { user } = useAuth();
  const rolePreview = useRolePreview();
  
  // Use effective role for UI rendering (respects preview mode)
  const userRole = rolePreview?.effectiveRole || user?.role;
  
  const userRoles = useMemo(() => {
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      // For multiple roles, use the preview role if available
      if (rolePreview?.isPreviewingRole) {
        return [rolePreview.effectiveRole];
      }
      return user.roles;
    }
    return userRole ? [userRole] : [];
  }, [user?.roles, userRole, rolePreview?.isPreviewingRole, rolePreview?.effectiveRole]);

  // Memoize permission checks to avoid recalculation
  const permissions = useMemo(() => {
    /**
     * Check if user has a specific permission
     * @param {string} permission - Permission name
     * @returns {boolean}
     */
    const can = (permission) => {
      if (userRoles.length === 0) return false;
      return userRoles.some((role) => hasPermission(role, permission));
    };

    /**
     * Check if user has any of the provided permissions
     * @param {string[]} permissionsList - Array of permissions
     * @returns {boolean}
     */
    const canAny = (permissionsList) => {
      if (userRoles.length === 0) return false;
      return userRoles.some((role) => hasAnyPermission(role, permissionsList));
    };

    /**
     * Check if user has all of the provided permissions
     * @param {string[]} permissionsList - Array of permissions
     * @returns {boolean}
     */
    const canAll = (permissionsList) => {
      if (userRoles.length === 0) return false;
      return permissionsList.every((permission) =>
        userRoles.some((role) => hasPermission(role, permission))
      );
    };

    /**
     * Check if user has a specific role
     * @param {string} role - Role name
     * @returns {boolean}
     */
    const isRole = (role) => {
      return userRoles.includes(role);
    };

    /**
     * Check if user has any of the provided roles
     * @param {string[]} rolesList - Array of roles
     * @returns {boolean}
     */
    const isAnyRole = (rolesList) => {
      if (userRoles.length === 0) return false;
      return rolesList.some((role) => userRoles.includes(role));
    };

    /**
     * Check if user can manage another role
     * @param {string} targetRole - Role to check against
     * @returns {boolean}
     */
    const canManage = (targetRole) => {
      if (userRoles.length === 0) return false;
      return userRoles.some((role) => canManageRole(role, targetRole));
    };

    /**
     * Get all permissions for current user's role
     * @returns {string[]}
     */
    const getAllPermissions = () => {
      if (userRoles.length === 0) return [];
      return [...new Set(userRoles.flatMap((role) => getRolePermissions(role)))];
    };

    /**
     * Get user's role hierarchy level
     * @returns {number}
     */
    const getHierarchyLevel = () => {
      if (userRoles.length === 0) return 0;
      return Math.max(...userRoles.map((role) => ROLE_HIERARCHY[role] || 0));
    };

    return {
      can,
      canAny,
      canAll,
      isRole,
      isAnyRole,
      canManage,
      getAllPermissions,
      getHierarchyLevel,
      role: userRole,
      ROLES,
    };
  }, [userRole, userRoles]);

  return permissions;
};
