/**
 * ParentBottomNav
 * Persistent 5-tab bottom navigation for the parent portal.
 *
 * Tabs: Home | Children | Fees | Inbox | More
 *
 * The active tab is derived from the current page route.
 * Inbox shows an unread badge from the UserNotificationContext.
 *
 * Renders only on mobile (block md:hidden) — desktop uses the sidebar.
 */
import React, { useEffect, useState } from 'react';
import { Home, Users, Wallet, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useUserNotifications } from '../../../contexts/UserNotificationContext';
import { translate, getLang } from '../pages/parent-portal/shared/parent-i18n';

const TABS = [
  { id: 'home',     labelKey: 'home',     icon: Home,           route: 'parent-portal-home' },
  { id: 'children', labelKey: 'children', icon: Users,          route: 'parent-portal-children' },
  { id: 'fees',     labelKey: 'fees',     icon: Wallet,         route: 'parent-portal-fees' },
  { id: 'inbox',    labelKey: 'inbox',    icon: MessageSquare,  route: 'parent-portal-messages' },
  { id: 'more',     labelKey: 'more',     icon: MoreHorizontal, route: 'parent-portal-more' },
];

// Map all parent-portal routes to their owning tab so we can highlight
// the correct tab even on sub-pages (e.g. parent-portal-attendance → children tab).
const ROUTE_TO_TAB = {
  'parent-portal-home':           'home',
  'parent-portal-children':       'children',
  'parent-portal-fees':           'fees',
  'parent-portal-messages':       'inbox',
  'parent-portal-communication':  'inbox',
  'parent-portal-more':           'more',
  // Sub-pages that belong to a primary tab
  'parent-portal-results':        'children',
  'parent-portal-attendance':     'children',
  'parent-portal-homework':       'children',
  'parent-portal-school-today':   'children',
  'parent-portal-academics':      'children',
  'parent-portal-pathway':        'children',
  'parent-portal-schools':        'children',
  'parent-portal-transport':      'more',
  'parent-portal-boarding':       'more',
  'parent-portal-documents':      'more',
  'parent-portal-support':        'more',
  'parent-portal-suggestion':     'more',
  'settings-profile':             'more',
  'events-calendar':              'more',
};

const ParentBottomNav = ({ currentPage, onNavigate }) => {
  const { unreadCount = 0 } = useUserNotifications?.() || {};
  const [lang, setLang] = useState(getLang);

  useEffect(() => {
    const syncLang = (event) => setLang(event.detail || getLang());
    window.addEventListener('trendscore:lang-change', syncLang);
    return () => window.removeEventListener('trendscore:lang-change', syncLang);
  }, []);

  const normalizedPage = currentPage?.split('?')[0] || 'parent-portal-home';
  const activeTabId = ROUTE_TO_TAB[normalizedPage] || 'home';

  return (
    <nav
      aria-label="Parent navigation"
      className="fixed inset-x-0 bottom-0 z-40 block border-t border-gray-200 bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-between">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabId === tab.id;
          const showBadge = tab.id === 'inbox' && unreadCount > 0;
          const label = translate(tab.labelKey, lang);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate?.(tab.route)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                isActive
                  ? 'text-[#3B1FA3]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#3B1FA3]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default ParentBottomNav;
