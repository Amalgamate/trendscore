/**
 * Mobile Bottom Navigation
 * Role-aware bottom navigation for mobile dashboards.
 * Clean, professional, understated educational SaaS design.
 */

import React from 'react';
import { getMobileNavConfig } from './MobileNavigationConfig';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import { hasPermission } from '../../../../config/permissions';

const MOBILE_LABELS = {
  dashboard: 'Home',
  attendance: 'Attend',
  timetable: 'Schedule',
  collections: 'Fees',
  grades: 'Assess',
  inbox: 'Inbox',
};

/**
 * Mobile Bottom Navigation Component
 * @param {Object} props
 * @param {string} props.role          - User role
 * @param {string} props.currentPath   - Current page path
 * @param {Function} props.onNavigate  - Navigation callback
 */
const MobileBottomNav = ({ role, currentPath = 'dashboard', onNavigate }) => {
  const { activeSlugs } = useModuleAccess();
  const navConfig = getMobileNavConfig(role);

  if (!navConfig) return null;

  const permissionRole = String(role).toUpperCase() === 'OWNER' ? 'ADMIN' : String(role).toUpperCase();
  const accessUser = { role: permissionRole, enabledApps: activeSlugs };
  const items = navConfig.items
    .filter((item) => !item.permission || hasPermission(permissionRole, item.permission))
    .filter((item) => hasPageAccess(accessUser, item.path))
    .filter((item) => item.id !== 'reports' && item.label?.toLowerCase() !== 'reports');

  if (!items.length) return null;

  const compactLabels = items.length > 5;
  const blueShades = ['#1d4ed8', '#1e40af', '#1e3a8a', '#2563eb', '#1e479f'];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-[80] w-full bg-[#172554] shadow-[0_-3px_14px_rgba(15,23,42,0.18)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="grid h-[68px] w-full"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const displayLabel = item.shortLabel || MOBILE_LABELS[item.id] || item.label;
          const activePaths = item.activePaths || [];
          const isActive =
            currentPath === item.path ||
            activePaths.includes(currentPath) ||
            (currentPath === 'dashboard' && item.id === 'dashboard');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-full min-w-0 flex-col items-center justify-center gap-1 border-r border-white/15 px-0.5 text-white transition-colors duration-150 last:border-r-0 active:brightness-110 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
                isActive
                  ? 'bg-blue-600'
                  : 'hover:bg-blue-800'
              }`}
              style={{ backgroundColor: isActive ? '#2563eb' : blueShades[index % blueShades.length] }}
            >
              <Icon size={compactLabels ? 22 : 21} strokeWidth={isActive ? 2.3 : 2} />
              {!compactLabels && <span className={`block w-full truncate text-center text-[10px] leading-none tracking-tight ${isActive ? 'font-bold' : 'font-semibold text-blue-50'}`}>
                {displayLabel}
              </span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
