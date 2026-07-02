/**
 * Mobile Bottom Navigation
 * Role-aware bottom navigation for mobile dashboards.
 * Brand colors are driven by CSS variables (--toolbar-bg, --brand-secondary)
 * so each school's branding applies automatically to the nav bar.
 */

import React from 'react';
import { getMobileNavConfig } from './MobileNavigationConfig';

const MOBILE_LABELS = {
  dashboard: 'Home',
  attendance: 'Attend',
  timetable: 'Time',
  collections: 'Fees',
};

/**
 * Mobile Bottom Navigation Component
 * @param {Object} props
 * @param {string} props.role          - User role
 * @param {string} props.currentPath   - Current page path
 * @param {Function} props.onNavigate  - Navigation callback
 */
const MobileBottomNav = ({ role, currentPath = 'dashboard', onNavigate }) => {
  const navConfig = getMobileNavConfig(role);

  if (!navConfig) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[80] border-t shadow-lg backdrop-blur-xl"
      style={{
        background: '#1d4ed8', // blue-700 - solid blue footer background
        borderColor: 'rgba(255,255,255,0.15)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="grid grid-cols-5 gap-0 w-full max-w-md mx-auto h-16 overflow-hidden">
        {navConfig.items.map((item) => {
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
              className="min-w-0 overflow-hidden flex flex-col items-center justify-center gap-1 px-1 transition-colors"
              style={
                isActive
                  ? {
                      background: 'var(--brand-secondary, #ff7900)',
                      color: '#1d4ed8',
                    }
                  : { color: 'rgba(255,255,255,0.70)' }
              }
            >
              <Icon
                size={20}
                style={
                  isActive
                    ? { color: '#1d4ed8' }
                    : { color: 'rgba(255,255,255,0.70)' }
                }
              />
              <span className="block w-full truncate text-center text-[9px] font-bold leading-none">
                {displayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;
