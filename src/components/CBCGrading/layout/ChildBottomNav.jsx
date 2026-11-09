/**
 * ChildBottomNav
 *
 * Context-aware bottom navigation for the parent portal's child-detail view.
 *
 * The global ParentBottomNav handles the landing-page level
 * (Home | Children | Fees | Inbox | More). This one handles the level
 * *inside* a single child: Diary | Attendance | Learning | Fees | More.
 *
 * Renders only on mobile (block md:hidden) — desktop shows the same
 * options as an inline row beneath the child header.
 */

import React from 'react';
import { BookOpen, CalendarDays, GraduationCap, Wallet, MoreHorizontal } from 'lucide-react';

const ChildBottomNav = ({ activeTab, onSelect, showFees = true }) => {
  const tabs = [
    { id: 'diary',      label: 'Diary',      icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: CalendarDays },
    { id: 'results',    label: 'Learning',   icon: GraduationCap },
    ...(showFees ? [{ id: 'fees', label: 'Fees', icon: Wallet }] : []),
    { id: 'more',       label: 'More',       icon: MoreHorizontal },
  ];

  return (
    <nav
      aria-label="Child sections"
      className="fixed inset-x-0 bottom-0 z-40 block border-t border-gray-200 bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect?.(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                isActive ? 'text-[#3B1FA3]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#3B1FA3]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default ChildBottomNav;
