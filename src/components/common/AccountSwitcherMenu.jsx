/**
 * Account Switcher Menu
 * Integrated dropdown menu that appears when clicking the avatar
 * Allows role preview for SUPER_ADMIN and logout
 * 
 * @component
 */

import React, { useState } from 'react';
import { Shield, LogOut, Search, RotateCcw, User } from 'lucide-react';
import { useRolePreview } from '../../contexts/RolePreviewContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

const AccountSwitcherMenu = ({ user, onLogout, onProfile }) => {
  const rolePreview = useRolePreview();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Only SUPER_ADMIN can see role switcher
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || rolePreview?.realRole === 'SUPER_ADMIN';

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

  const displayRole = rolePreview?.effectiveRole || user?.role;
  const isPreviewingRole = rolePreview?.isPreviewingRole;

  const handleRoleSelect = (role) => {
    if (!rolePreview) return;
    
    if (role === rolePreview.realRole) {
      rolePreview.resetPreviewRole?.();
    } else {
      rolePreview.setPreviewRole?.(role);
    }
  };

  const handleResetRole = () => {
    rolePreview?.resetPreviewRole?.();
  };

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout?.();
  };

  const handleProfile = () => {
    setMenuOpen(false);
    onProfile?.();
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 p-0 relative group hover:bg-gray-100 transition-colors"
          title={`${user?.name || 'User'} - Click to switch role or logout`}
        >
          <div className={cn(
            "w-10 h-10 bg-brand-purple rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 transition-transform group-hover:scale-105",
            isPreviewingRole ? 'border-amber-400 shadow-lg shadow-amber-200' : 'border-white shadow-md'
          )}>
            {(user?.name || 'U').substring(0, 2).toUpperCase()}
          </div>
          {isPreviewingRole && (
            <div className="absolute top-0 right-0 w-3 h-3 bg-amber-400 border-2 border-white rounded-full animate-pulse"></div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        {/* User Info Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">
            {user?.email || 'No email'}
          </p>
        </div>

        {/* SUPER_ADMIN Role Switcher Section */}
        {isSuperAdmin && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-4 pt-3 pb-2">
              Preview Role
            </DropdownMenuLabel>

            {/* Search Input */}
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent bg-white"
                />
              </div>
            </div>

            {/* Role Options */}
            <div className="py-2 max-h-64 overflow-y-auto">
              {availableRoles
                .filter(role => 
                  formatRoleName(role).toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelect(role)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors border-0 cursor-pointer text-left',
                      displayRole === role && 'bg-blue-50'
                    )}
                  >
                    {/* Checkbox */}
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                      displayRole === role
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-300 bg-white'
                    )}>
                      {displayRole === role && (
                        <div className="w-2 h-2 bg-white rounded-sm"></div>
                      )}
                    </div>

                    {/* Role Badge */}
                    <div className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold flex-shrink-0',
                      getRoleColor(role)
                    )}>
                      <Shield size={10} />
                      <span>{formatRoleName(role)}</span>
                    </div>

                    {/* Real Role Indicator */}
                    {role === rolePreview?.realRole && (
                      <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
                        Real
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {/* Reset Button */}
            {isPreviewingRole && (
              <>
                <DropdownMenuSeparator className="my-2" />
                <button
                  onClick={handleResetRole}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors text-left border-0 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  Reset to Real Role
                </button>
              </>
            )}

            <DropdownMenuSeparator className="my-2" />
          </>
        )}

        <button
          onClick={handleProfile}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors text-left border-0 cursor-pointer"
        >
          <User size={16} />
          My Profile
        </button>

        <DropdownMenuSeparator className="my-2" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors text-left border-0 cursor-pointer"
        >
          <LogOut size={16} />
          Logout
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountSwitcherMenu;
