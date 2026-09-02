/**
 * Mobile Bottom Navigation
 * Role-aware bottom navigation for mobile dashboards.
 * Clean, professional, understated educational SaaS design.
 */

import React from 'react';
import { getMobileNavConfig } from './MobileNavigationConfig';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';

const MOBILE_LABELS = {
  dashboard: 'Home',
  attendance: 'Attend',
  timetable: 'Schedule',
  collections: 'Fees',
  grades: 'Assess',
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

  const accessUser = { role, enabledApps: activeSlugs };
  const items = navConfig.items
    .filter((item) => hasPageAccess(accessUser, item.path))
    .filter((item) => item.id !== 'reports' && item.label?.toLowerCase() !== 'reports');

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-[80] border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="grid w-full max-w-md mx-auto h-16 p-1.5 gap-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
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
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-w-0 h-full flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-150 active:scale-95 focus:outline-none ${
                isActive
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
              <span
                className={`block w-full truncate text-center text-[10px] tracking-tight leading-none ${
                  isActive ? 'font-bold text-white' : 'font-medium'
                }`}
              >
                {displayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
