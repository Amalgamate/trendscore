/**
 * Mobile Bottom Navigation
 * Role-aware bottom navigation for mobile dashboards
 */

import React from 'react';
import { getMobileNavConfig } from './MobileNavigationConfig';

/**
 * Mobile Bottom Navigation Component
 * @param {Object} props - Component props
 * @param {string} props.role - User role
 * @param {string} props.currentPath - Current page path
 * @param {Function} props.onNavigate - Navigation callback
 */
const MobileBottomNav = ({ role, currentPath = 'dashboard', onNavigate }) => {
  const navConfig = getMobileNavConfig(role);

  if (!navConfig) {
    return null; // No nav config for this role
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="grid grid-cols-5 gap-0 max-w-md mx-auto h-16">
        {navConfig.items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (currentPath === 'dashboard' && item.id === 'dashboard');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'bg-brand-purple/10 text-brand-purple'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-brand-purple' : 'text-gray-600'} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;
