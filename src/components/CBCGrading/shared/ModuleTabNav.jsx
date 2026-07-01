/**
 * ModuleTabNav — single shared tab navigation bar for all module-level pages.
 *
 * This is the ONE source of truth for the inner-page tab style.
 * It mirrors the global secondary menu: flat band, compact tabs, no card chrome.
 *
 * Usage:
 *   const TABS = [
 *     { id: 'terms',       label: 'Academic Year & Terms', icon: <Calendar size={13} /> },
 *     { id: 'classes',     label: 'Classes',               icon: <Users size={13} /> },
 *   ];
 *   <ModuleTabNav sectionLabel="ACADEMICS" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
 */

import React from 'react';

const ModuleTabNav = ({
  tabs = [],
  activeTab,
  onTabChange,
  sectionLabel,
  className = '',
  flushToShell = true,
}) => (
  <div className={`sticky top-0 z-30 border-b border-gray-200 bg-gray-100/95 backdrop-blur-md ${flushToShell ? 'module-tab-nav-shell' : ''} ${className}`}>
    <div className="app-layout-row flex items-center gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap py-2">
      {sectionLabel && (
        <>
          <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {sectionLabel}
          </span>
          <span className="mr-2 h-4 w-px bg-gray-200" />
        </>
      )}

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={!!tab.disabled}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            className={[
              // ── core layout — matches HorizontalSubmenu NavItem ──────────
              'flex items-center gap-1.5 whitespace-nowrap',
              'rounded-md px-2.5 py-1.5 text-xs font-medium',
              'transition-all focus-visible:outline-none',
              // ── state variants ────────────────────────────────────────────
              isActive
                ? 'text-blue-700 bg-blue-50'
                : tab.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
            ].join(' ')}
          >
            {Icon && (
              <span className="flex-shrink-0 opacity-80">
                {React.isValidElement(Icon) ? Icon : <Icon size={13} />}
              </span>
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
