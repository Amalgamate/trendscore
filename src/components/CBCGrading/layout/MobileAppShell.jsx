import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  LogOut,
  Search,
  Settings,
} from 'lucide-react';
import MobileBottomNav from '../dashboard/mobile/MobileBottomNav';
import MobileCommunicationCenter from './MobileCommunicationCenter';

const MobileAppShell = ({ children, user, onNavigate, onLogout, currentPage, brandingSettings }) => {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  const schoolName =
    brandingSettings?.schoolName ||
    brandingSettings?.name ||
    user?.school?.name ||
    user?.schoolName ||
    'School Portal';

  const schoolLogo =
    brandingSettings?.logoUrl ||
    user?.school?.logoUrl ||
    user?.school?.logo ||
    '/branding/logo.png';

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || user?.email || 'User';
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
  const avatarUrl = user?.profilePicture || user?.avatarUrl || user?.avatar || user?.photoUrl || user?.imageUrl;

  useEffect(() => {
    if (!avatarMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [avatarMenuOpen]);

  const handleMenuNavigate = (page) => {
    setAvatarMenuOpen(false);
    onNavigate?.(page);
  };

  return (
    <div className="ts-mobile-app h-[100dvh] w-full flex flex-col overflow-hidden relative text-white">
      <div className="ts-mobile-header flex min-h-16 items-center justify-between border-b border-[#ff7900]/35 px-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-white border border-[#ff7900] flex items-center justify-center overflow-hidden">
            <img
              src={schoolLogo}
              alt={`${schoolName} logo`}
              className="w-7 h-7 object-contain"
              onError={(e) => { e.currentTarget.src = '/branding/logo.png'; }}
            />
          </div>
          <div>
            <div className="max-w-[170px] truncate text-[13px] font-semibold text-white leading-tight">
              {schoolName}
            </div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-white/65">School Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-[10px] border border-[#ff7900] bg-transparent flex items-center justify-center text-white">
            <Search size={16} />
          </button>
          <MobileCommunicationCenter user={user} onNavigate={onNavigate} />
          <div className="relative" ref={avatarMenuRef}>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((open) => !open)}
              className="h-9 rounded-[10px] border border-[#ff7900] bg-white/10 px-1.5 flex items-center gap-1.5 text-white"
              aria-label="Open account menu"
              aria-expanded={avatarMenuOpen}
            >
              <span className="w-7 h-7 rounded-full bg-white text-[#06285a] flex items-center justify-center overflow-hidden text-[11px] font-bold">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <ChevronDown size={14} className={`transition-transform ${avatarMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {avatarMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-xl">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold truncate">{fullName}</div>
                  <div className="text-xs text-gray-500 truncate">{user?.role || user?.email || 'Account'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleMenuNavigate('settings-profile')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-50"
                >
                  <Settings size={17} className="text-brand-purple" />
                  Settings
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={17} />
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ts-mobile-scroll flex-1 overflow-y-auto pb-24">{children}</div>

      <MobileBottomNav role={user?.role} currentPath={currentPage} onNavigate={onNavigate} />
    </div>
  );
};

export default MobileAppShell;
