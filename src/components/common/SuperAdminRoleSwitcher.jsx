/**
 * Super Admin Role Switcher
 * Dropdown component allowing SUPER_ADMIN to preview roles without logging out
 * Only visible to SUPER_ADMIN users
 * 
 * Security Note:
 * Preview role affects frontend rendering only. Backend authorization remains based on authenticated SUPER_ADMIN session.
 * No security bypass - all API calls still require SUPER_ADMIN token validation.
 * 
 * @component
 */

import React, { useMemo } from 'react';
import { Shield, ChevronDown, RotateCcw } from 'lucide-react';
import { useRolePreview } from '../../contexts/RolePreviewContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../utils/cn';

/**
 * Format role name for display
 */
const formatRoleName = (role) => {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Get role color/badge style based on role type
 */
const getRoleColor = (role) => {
  const colorMap = {
    SUPER_ADMIN: 'bg-red-50 text-red-700 border-red-200',
    ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    HEAD_TEACHER: 'bg-blue-50 text-blue-700 border-blue-200',
    HEAD_OF_CURRICULUM: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    TEACHER: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ACCOUNTANT: 'bg-green-50 text-green-700 border-green-200',
    RECEPTIONIST: 'bg-amber-50 text-amber-700 border-amber-200',
    PARENT: 'bg-pink-50 text-pink-700 border-pink-200',
    STUDENT: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return colorMap[role] || 'bg-gray-50 text-gray-700 border-gray-200';
};

const SuperAdminRoleSwitcher = () => {
  const { realRole, effectiveRole, isPreviewingRole, setPreviewRole, resetPreviewRole, previewRole } = useRolePreview();

  // Only render if user is SUPER_ADMIN
  if (realRole !== 'SUPER_ADMIN') {
    return null;
  }

  const availableRoles = [
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

  const displayRole = effectiveRole || realRole;
  const roleColor = getRoleColor(displayRole);

  return (
    <div className="flex items-center gap-2">
      {/* Preview Banner - visible only when previewing */}
      {isPreviewingRole && (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Viewing as {formatRoleName(effectiveRole)}
          </span>
          <span className="text-amber-800">—</span>
          <span className="text-xs text-amber-700 font-medium">Super Admin Preview</span>
        </div>
      )}

      {/* Role Switcher Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 gap-2 border text-xs font-semibold uppercase tracking-wider transition-all',
              isPreviewingRole
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-gray-200 hover:bg-gray-50'
            )}
          >
            <Shield size={14} className={cn(isPreviewingRole && 'text-amber-600')} />
            <span className="hidden sm:inline">View as</span>
            <span className={cn('font-bold', roleColor.split(' ')[1])}>
              {formatRoleName(displayRole)}
            </span>
            <ChevronDown size={14} className="ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Preview Role
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableRoles.map((role) => (
            <DropdownMenuCheckboxItem
              key={role}
              checked={effectiveRole === role}
              onCheckedChange={() => {
                if (role === realRole) {
                  resetPreviewRole();
                } else {
                  setPreviewRole(role);
                }
              }}
              className={cn(
                'cursor-pointer text-xs font-medium',
                role === 'SUPER_ADMIN' && 'border-b border-gray-100 pb-1 mb-1'
              )}
            >
              <div className={cn('inline-flex items-center gap-2 px-2 py-0.5 rounded border text-xs font-semibold', getRoleColor(role))}>
                <span>{formatRoleName(role)}</span>
                {role === realRole && (
                  <span className="ml-1 text-[10px] font-bold opacity-70">(Real)</span>
                )}
              </div>
            </DropdownMenuCheckboxItem>
          ))}

          {isPreviewingRole && (
            <>
              <DropdownMenuSeparator />
              <button
                onClick={resetPreviewRole}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors rounded"
              >
                <RotateCcw size={12} />
                Reset to Super Admin
              </button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

SuperAdminRoleSwitcher.displayName = 'SuperAdminRoleSwitcher';

export default SuperAdminRoleSwitcher;
