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
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { cn } from '../../../utils/cn';

const TAB_TONES = [
  'text-indigo-700 bg-indigo-50',
  'text-violet-700 bg-violet-50',
  'text-emerald-700 bg-emerald-50',
  'text-amber-700 bg-amber-50',
  'text-sky-700 bg-sky-50',
  'text-rose-700 bg-rose-50',
  'text-teal-700 bg-teal-50',
  'text-fuchsia-700 bg-fuchsia-50',
];

const ModuleTabNav = ({
  tabs = [],
  activeTab,
  onTabChange,
  sectionLabel,
  className = '',
  flushToShell = true,
  variant = 'tabs',
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeTabConfig?.icon;

  if (variant === 'dropdown') {
    return (
      <div className={`horizontal-menu-shell sticky top-0 z-30 border-b border-gray-200 bg-gray-100/95 backdrop-blur-md ${flushToShell ? 'module-tab-nav-shell' : ''} ${className}`}>
        <div className="app-layout-row flex items-center gap-2 py-2">
          {sectionLabel && (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {sectionLabel}
              </span>
              <span className="h-4 w-px bg-gray-200" />
            </>
          )}

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-w-[13rem] max-w-full items-center justify-between gap-2 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {ActiveIcon && (
                    <span className="flex-shrink-0 opacity-80">
                      {React.isValidElement(ActiveIcon) ? ActiveIcon : <ActiveIcon size={13} />}
                    </span>
                  )}
                  <span className="truncate">{activeTabConfig?.label || 'Select Section'}</span>
                  {activeTabConfig?.badge != null && (
                    <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-blue-700">
                      {activeTabConfig.badge}
                    </span>
                  )}
                </span>
                <ChevronDown size={13} className="flex-shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-64 p-1">
              {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                const tone = TAB_TONES[index % TAB_TONES.length];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={!!tab.disabled}
                    onClick={() => {
                      if (tab.disabled) return;
                      onTabChange(tab.id);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-xs font-medium transition',
                      'focus-visible:outline-none focus-visible:bg-gray-100',
                      isActive
                        ? `${tone} font-semibold ring-1 ring-current/10`
                      : tab.disabled
                        ? 'cursor-not-allowed text-gray-300'
                        : `${tone} hover:opacity-90`
                    )}
                  >
                    {Icon && (
                      <span className="flex-shrink-0 opacity-80">
                        {React.isValidElement(Icon) ? Icon : <Icon size={13} />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    {tab.badge != null && (
                      <span className={cn(
                        'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                        isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className={`horizontal-menu-shell sticky top-0 z-30 border-b border-gray-200 bg-gray-100/95 backdrop-blur-md ${flushToShell ? 'module-tab-nav-shell' : ''} ${className}`}>
      <div className="app-layout-row flex items-center gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap py-2">
        {sectionLabel && (
          <>
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {sectionLabel}
            </span>
            <span className="mr-2 h-4 w-px bg-gray-200" />
          </>
        )}

        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const tone = TAB_TONES[index % TAB_TONES.length];
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
                'transition-all hover:opacity-90 focus-visible:outline-none',
                // ── state variants ────────────────────────────────────────────
                isActive
                  ? `${tone} font-semibold ring-1 ring-current/10 shadow-sm`
                  : tab.disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : tone,
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
};

export default ModuleTabNav;
