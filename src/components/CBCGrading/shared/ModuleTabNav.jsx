/**
 * ModuleTabNav — single shared tab navigation bar for all module-level pages.
 *
 * This is the ONE source of truth for the inner-page tab style.
 * It matches the HorizontalSubmenu NavItem scale: text-xs, compact padding.
 *
 * Usage:
 *   const TABS = [
 *     { id: 'terms',       label: 'Academic Year & Terms', icon: <Calendar size={13} /> },
 *     { id: 'classes',     label: 'Classes',               icon: <Users size={13} /> },
 *   ];
 *   <ModuleTabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
 */

import React from 'react';

const ModuleTabNav = ({ tabs = [], activeTab, onTabChange, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    <div className="border-b border-gray-200 flex overflow-x-auto custom-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={!!tab.disabled}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            className={[
              // ── core layout — matches HorizontalSubmenu NavItem ──────────
              'flex items-center gap-1.5 whitespace-nowrap',
              'px-3.5 py-2.5 text-xs font-medium',
              'border-b-2 transition-all focus-visible:outline-none',
              // ── state variants ────────────────────────────────────────────
              isActive
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : tab.disabled
                  ? 'border-transparent text-gray-300 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50',
            ].join(' ')}
          >
            {tab.icon && (
              <span className="flex-shrink-0 opacity-80">{tab.icon}</span>
            )}
            {tab.label}
            {tab.badge != null && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${
                isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default ModuleTabNav;
