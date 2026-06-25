/**
 * MobilePortalAppBar
 * Shared white app bar used across all mobile role dashboards.
 * Shows: school logo · notification bell (live count) · avatar dropdown
 *
 * Accepts a `accentColor` prop so each role can tint the avatar ring:
 *   - teacher/admin: var(--brand-secondary, #ff7900)
 *   - parent:        #3B1FA3
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Settings } from 'lucide-react';
import { useUserNotifications } from '../../../contexts/UserNotificationContext';
import axiosInstance from '../../../services/api/axiosConfig';

const GENERIC_SCHOOL_NAMES = new Set([
  'school',
  'school portal',
  'school management',
  'school management system',
  'your school',
  'academic school',
]);

const normalizeDisplayValue = (value) => String(value || '').trim();

const isGenericSchoolName = (value) => {
  const normalized = normalizeDisplayValue(value).toLowerCase();
  return !normalized || GENERIC_SCHOOL_NAMES.has(normalized) || normalized.startsWith('trendscore');
};

const pickSchoolName = (...values) => {
  const normalizedValues = values.map(normalizeDisplayValue).filter(Boolean);
  return (
    normalizedValues.find((value) => !isGenericSchoolName(value)) ||
    normalizedValues[0] ||
    'School Portal'
  );
};

const MobilePortalAppBar = ({
  user,
  onNavigate,
  onLogout,
  brandingSettings,
  accentColor = 'var(--brand-secondary, #ff7900)',
  bellTarget,        // page to open when bell is tapped, e.g. 'parent-portal-messages'
}) => {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef(null);

  const { unreadCount = 0 } = useUserNotifications?.() || {};

  const baseSchoolName = pickSchoolName(
    user?.school?.name,
    user?.school?.schoolName,
    user?.schoolName,
    brandingSettings?.schoolName,
    brandingSettings?.name,
  );
  const [schoolName, setSchoolName] = useState(baseSchoolName);

  const schoolLogo =
    brandingSettings?.logoUrl ||
    user?.school?.logoUrl ||
    user?.school?.logo ||
    '/branding/logo.png';

  const initials =
    `${user?.firstName || ''} ${user?.lastName || ''}`
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'U';

  const avatarUrl =
    user?.profilePicture ||
    user?.avatarUrl ||
    user?.avatar ||
    user?.photoUrl ||
    user?.imageUrl;

  // Close dropdown on outside tap
  useEffect(() => {
    if (!avatarOpen) return undefined;
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [avatarOpen]);

  useEffect(() => {
    setSchoolName(baseSchoolName);
  }, [baseSchoolName]);

  useEffect(() => {
    let cancelled = false;

    const loadSchoolName = async () => {
      try {
        const response = await axiosInstance.get('/schools');
        const school = response?.data?.data || response?.data;
        const fetchedName = pickSchoolName(
          school?.name,
          school?.schoolName,
          baseSchoolName,
        );
        if (!cancelled) {
          setSchoolName(fetchedName);
        }
      } catch {
        // Keep the best available local fallback when school metadata is unavailable.
      }
    };

    loadSchoolName();

    return () => {
      cancelled = true;
    };
  }, [baseSchoolName]);

  const handleNav = (page) => {
    setAvatarOpen(false);
    onNavigate?.(page);
  };

  return (
    <div className="bg-white sticky top-0 z-30 border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 min-h-[86px]">

        {/* ── Left: school logo ── */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50 border border-gray-200 flex-shrink-0"
          >
            <img
              src={schoolLogo}
              alt={schoolName}
              className="w-10 h-10 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[150px] leading-tight">
            {schoolName}
          </span>
        </div>

        <div className="flex-1" />

        {/* ── Right: bell · avatar ── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Bell — real unread count from UserNotificationContext */}
          <button
            type="button"
            onClick={() => onNavigate?.(bellTarget || 'comm-messages')}
            className="w-11 h-11 flex items-center justify-center relative rounded-xl hover:bg-gray-50"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell size={22} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Avatar + dropdown */}
          <div className="relative" ref={avatarRef}>
            <button
              type="button"
              onClick={() => setAvatarOpen((v) => !v)}
              aria-label="Account menu"
              aria-expanded={avatarOpen}
              className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0 border-2 border-blue-500 shadow-sm"
              style={{ background: accentColor }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>{initials}</span>
              )}
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNav('settings-profile')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Settings size={16} className="text-gray-400" />
                  Settings
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => { setAvatarOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobilePortalAppBar;
