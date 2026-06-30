/**
 * Account Switcher Menu
 * Integrated dropdown menu that appears when clicking the avatar.
 * For SUPER_ADMIN and ADMIN users, the Preview Role section is replaced with
 * the ImpersonationSearchBox that allows logging in as any user.
 *
 * @component
 */

import React, { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { useRolePreview } from '../../contexts/RolePreviewContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../utils/cn';
import ImpersonationSearchBox from '../ImpersonationSearchBox';

/**
 * Format role name for display
 */
const formatRoleName = (role) => {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const AccountSwitcherMenu = ({ user, onLogout, onProfile }) => {
  const rolePreview = useRolePreview();
  const { startImpersonation, isLoading: impersonationLoading, error: impersonationError } = useImpersonation();
  const [menuOpen, setMenuOpen] = useState(false);

  // SUPER_ADMIN and ADMIN can impersonate users (Req 1.1)
  const canImpersonate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
    || rolePreview?.realRole === 'SUPER_ADMIN' || rolePreview?.realRole === 'ADMIN';

  const displayRole = rolePreview?.effectiveRole || user?.role;
  const isPreviewingRole = rolePreview?.isPreviewingRole;

  const handleUserSelect = async (selectedUser) => {
    setMenuOpen(false);
    await startImpersonation(selectedUser.id);
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
          title={`${user?.name || 'User'} - Click to switch user or logout`}
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

        {/* ── Impersonation Search (SUPER_ADMIN and ADMIN) ── */}
        {canImpersonate && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-4 pt-3 pb-2">
              Log In As User
            </DropdownMenuLabel>

            <div className="px-3 pb-3">
              <ImpersonationSearchBox
                onUserSelect={handleUserSelect}
                disabled={impersonationLoading}
              />
              {/* Inline error from impersonation attempt */}
              {impersonationError && (
                <p className="mt-1.5 text-xs text-red-600 px-1">{impersonationError}</p>
              )}
            </div>

            <DropdownMenuSeparator className="my-1" />
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
