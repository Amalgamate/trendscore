/**
 * Sidebar Component — Industry-Grade Rewrite
 */

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  Menu, X,
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  Brain,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  Mail,
  MoreHorizontal,
  Receipt,
  Rocket,
  ShieldAlert,
  Wrench
} from 'lucide-react';
import { useNavigation, groupNavigationByCategory } from '../hooks/useNavigation';
import { useInstitutionLabels } from '../../../hooks/useInstitutionLabels';
import { usePermissions } from '../../../hooks/usePermissions';

// ─── constants ────────────────────────────────────────────────────────────────
const SIDEBAR_COLLAPSED_W = 64;
const SIDEBAR_EXPANDED_W  = 224;
const HEADER_H            = 72;

// ─── Branding-driven sidebar palette ─────────────────────────────────────────
const normalizeHexColor = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return null;
};

const darkenHex = (hex, amount = 0.78) => {
  const color = normalizeHexColor(hex);
  if (!color) return 'var(--brand-secondary-dark)';
  const raw = color.slice(1);
  const darken = (pair) => Math.max(0, Math.floor(parseInt(pair, 16) * amount)).toString(16).padStart(2, '0');
  return `#${darken(raw.slice(0, 2))}${darken(raw.slice(2, 4))}${darken(raw.slice(4, 6))}`;
};

const getSidebarTheme = (brandingSettings) => {
  const primary = normalizeHexColor(
    brandingSettings?.primaryColor
  ) || 'var(--brand-primary)';
  const secondary = normalizeHexColor(brandingSettings?.secondaryColor) || 'var(--brand-secondary)';

  return {
    bg: secondary,
    dark: darkenHex(secondary),
    accent: primary,
  };
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const findDefaultPath = (items = []) => {
  for (const item of items) {
    if (item.type === 'group') {
      const p = findDefaultPath(item.items);
      if (p) return p;
    } else if (!item.greyedOut && item.path) {
      return item.path;
    }
  }
  return null;
};

const sectionContainsPage = (section, currentPage) => {
  if (!section || !currentPage) return false;
  if (section.id === currentPage || section.path === currentPage) return true;
  const checkItems = (items = []) => items.some((item) => (
    item.type === 'group'
      ? checkItems(item.items)
      : item.path === currentPage || item.id === currentPage
  ));
  return checkItems(section.items);
};

const getCollapsedIconColor = (id, isActive) => {
  if (isActive) return 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]';
  switch (id) {
    case 'finance':         return 'text-red-500    drop-shadow-[0_0_6px_rgba(239,68,68,0.7)]   group-hover:text-red-400    group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]';
    case 'parent-portal-finance': return 'text-rose-500  drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]   group-hover:text-rose-400   group-hover:drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]';
    case 'parent-portal-academics': return 'text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.7)] group-hover:text-amber-300  group-hover:drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]';
    case 'learners':        return 'text-blue-500   drop-shadow-[0_0_6px_rgba(59,130,246,0.7)]  group-hover:text-blue-400   group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.9)]';
    case 'teachers':        return 'text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)] group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.9)]';
    case 'parents':         return 'text-fuchsia-500 drop-shadow-[0_0_6px_rgba(217,70,239,0.7)] group-hover:text-fuchsia-400 group-hover:drop-shadow-[0_0_10px_rgba(217,70,239,0.9)]';
    case 'assessment':      return 'text-amber-500  drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]  group-hover:text-amber-400  group-hover:drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]';
    case 'academic-intelligence': return 'text-indigo-400 drop-shadow-[0_0_6px_rgba(129,140,248,0.7)] group-hover:text-indigo-300 group-hover:drop-shadow-[0_0_10px_rgba(129,140,248,0.9)]';
    case 'communications':  return 'text-cyan-500   drop-shadow-[0_0_6px_rgba(6,182,212,0.7)]   group-hover:text-cyan-400   group-hover:drop-shadow-[0_0_10px_rgba(6,182,212,0.9)]';
    case 'planner':         return 'text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.7)]  group-hover:text-orange-400 group-hover:drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]';
    case 'learning-hub':    return 'text-indigo-500 drop-shadow-[0_0_6px_rgba(99,102,241,0.7)]  group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.9)]';
    case 'lms':             return 'text-pink-500   drop-shadow-[0_0_6px_rgba(236,72,153,0.7)]  group-hover:text-pink-400   group-hover:drop-shadow-[0_0_10px_rgba(236,72,153,0.9)]';
    case 'attendance':      return 'text-lime-500   drop-shadow-[0_0_6px_rgba(132,204,22,0.7)]  group-hover:text-lime-400   group-hover:drop-shadow-[0_0_10px_rgba(132,204,22,0.9)]';
    case 'docs-center':     return 'text-sky-500    drop-shadow-[0_0_6px_rgba(14,165,233,0.7)]  group-hover:text-sky-400    group-hover:drop-shadow-[0_0_10px_rgba(14,165,233,0.9)]';
    case 'hr':              return 'text-teal-500   drop-shadow-[0_0_6px_rgba(20,184,166,0.7)]  group-hover:text-teal-400   group-hover:drop-shadow-[0_0_10px_rgba(20,184,166,0.9)]';
    case 'library':         return 'text-violet-500 drop-shadow-[0_0_6px_rgba(139,92,246,0.7)]  group-hover:text-violet-400 group-hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]';
    case 'transport':       return 'text-rose-500   drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]   group-hover:text-rose-400   group-hover:drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]';
    case 'inventory':       return 'text-yellow-500 drop-shadow-[0_0_6px_rgba(234,179,8,0.7)]   group-hover:text-yellow-400 group-hover:drop-shadow-[0_0_10px_rgba(234,179,8,0.9)]';
    case 'biometric':       return 'text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)] group-hover:text-emerald-300 group-hover:drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]';
    case 'settings':
    case 'dashboard':       return 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)] group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]';
    default:                return 'text-white/60 group-hover:text-white group-hover:drop-shadow-md';
  }
};

// ─── Route → chunk prefetch map ──────────────────────────────────────────────
const PREFETCH_MAP = {
  'learners-list':        () => import('../pages/LearnersList'),
  'teachers-list':        () => import('../pages/TeachersList'),
  'parents-list':         () => import('../pages/ParentsList'),
  'attendance-daily':     () => import('../pages/attendance/AttendanceModule'),
  'attendance-reports':   () => import('../pages/attendance/AttendanceReportsV2'),
  'attendance-configuration': () => import('../pages/attendance/AttendanceSettingsPage'),
  'assess-formative':     () => import('../pages/FormativeAssessment'),
  'assess-summative-tests':() => import('../pages/SummativeTestsRouter'),
  'fees-overview':        () => import('../pages/FeeCollectionPage'),
  'fees-collection':      () => import('../pages/FeeCollectionPage'),
  'fees-unmatched':       () => import('../pages/FeeCollectionPage'),
  'fees-waivers':         () => import('../pages/FeeCollectionPage'),
  'fees-statements':      () => import('../pages/FeeCollectionPage'),
  'fees-types':           () => import('../pages/FeeCollectionPage'),
  'fees-structure':       () => import('../pages/FeeCollectionPage'),
  'fees-reports':         () => import('../pages/FeeReportsPage'),
  'comm-notices':         () => import('../pages/NoticesPage'),
  'hr-portal':            () => import('../pages/hr/HRManager'),
  'hr-payroll':           () => import('../pages/hr/PayrollManager'),
  'accounting-dashboard': () => import('../pages/accounting/AccountingManager'),
  'inventory-items':      () => import('../pages/inventory/InventoryItems'),
  'library-catalog':      () => import('../pages/library/LibraryManager'),
  'transport-routes':     () => import('../pages/transport/TransportManager'),
  'settings-school':      () => import('../pages/settings/SchoolSettings'),
  'settings-users':       () => import('../pages/settings/UserManagement'),
  'planner-duty-roster':  () => import('../pages/planner/DutyRosterPage'),
};

const prefetch = (path) => {
  if (!path || !PREFETCH_MAP[path]) return;
  PREFETCH_MAP[path]().catch(() => {});
};

const ACCOUNTANT_NAV_GROUPS = [
  {
    label: 'Finance',
    items: [
      { label: 'Dashboard', path: 'finance-dashboard', icon: Home },
      { label: 'Fee Management', path: 'fees-overview', icon: Receipt },
      { label: 'Expenses', path: 'accounting-expenses', icon: Receipt },
      { label: 'Banking', path: 'accounting-reconciliation', icon: Building2 },
      { label: 'Chart of Accounts', path: 'accounting-accounts', icon: BookOpen },
      { label: 'Budgets', path: 'accounting-dashboard', icon: Activity },
      { label: 'Reports', path: 'accounting-reports', icon: BarChart3 },
      { label: 'Audit Trail', path: 'settings-system-logs', icon: Activity },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Notices & Announcements', path: 'comm-notices', icon: Mail },
      { label: 'Messages', path: 'comm-messages', icon: Mail },
      { label: 'Message History', path: 'comm-history', icon: FileText },
    ],
  },
  {
    label: 'Documents',
    items: [
      { label: 'Document Center', path: 'docs-center', icon: FileText },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users & Roles',   path: 'settings-users',          icon: BookOpen  },
      { label: 'System Logs',     path: 'settings-system-logs',    icon: FileText  },
      { label: 'System Control',  path: 'settings-system-control', icon: ShieldAlert },
    ],
  },
];

// ─── Sidebar (root) ───────────────────────────────────────────────────────────
const Sidebar = React.memo(({
  sidebarOpen,
  setSidebarOpen,
  currentPage,
  onNavigate,
  brandingSettings,
  user,
  onOpenGitDialog,
}) => {
  const labels = useInstitutionLabels();
  const { role } = usePermissions();

  const theme = useMemo(() => getSidebarTheme(brandingSettings), [brandingSettings]);
  const navScrollRef = useRef(null);
  const sectionRefs = useRef({});

  const navData = useNavigation();

  // Group navigation into simplified categories
  const groupedNav = useMemo(() => {
    return groupNavigationByCategory(navData);
  }, [navData]);

  const handleSectionClick = useCallback((section) => {
    const path = findDefaultPath(section.items);
    if (path) onNavigate(path);
    else if (!sidebarOpen) setSidebarOpen(true);
  }, [onNavigate, setSidebarOpen, sidebarOpen]);

  const activeSectionId = useMemo(() => {
    for (const group of groupedNav) {
      const activeSection = group.items.find((section) => sectionContainsPage(section, currentPage));
      if (activeSection) return activeSection.id;
    }
    return null;
  }, [currentPage, groupedNav]);

  useEffect(() => {
    if (!sidebarOpen || !activeSectionId) return;
    const timer = window.setTimeout(() => {
      const sectionNode = sectionRefs.current[activeSectionId];
      const scrollNode = navScrollRef.current;
      if (!sectionNode || !scrollNode) return;

      const sectionTop = sectionNode.offsetTop;
      const sectionBottom = sectionTop + sectionNode.offsetHeight;
      const visibleTop = scrollNode.scrollTop;
      const visibleBottom = visibleTop + scrollNode.clientHeight;

      if (sectionTop < visibleTop || sectionBottom > visibleBottom) {
        scrollNode.scrollTo({
          top: Math.max(sectionTop - 24, 0),
          behavior: 'smooth',
        });
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [activeSectionId, sidebarOpen]);

  const sharedNavProps = {
    handleSectionClick,
    sidebarOpen,
    currentPage,
    onNavigate,
    accentColor: theme.accent,
  };

  const sidebarW = sidebarOpen ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;

  if (role === 'ACCOUNTANT' && !navData?.isSidebarRestricted) {
    const financeBg = '#080083';
    const financeDark = '#05005f';
    return (
      <aside
        style={{ width: sidebarW, backgroundColor: financeBg }}
        className="relative flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-white/10 text-white transition-[width] duration-300 ease-in-out z-30"
      >
        <div
          style={{ height: HEADER_H, backgroundColor: financeDark }}
          className="flex flex-shrink-0 items-center gap-3 border-b border-white/10 px-5"
        >
          {brandingSettings?.logoUrl ? (
            <img
              src={brandingSettings.logoUrl}
              alt="School Logo"
              className="h-11 w-11 flex-shrink-0 object-contain"
            />
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-amber-300 bg-white text-xs font-extrabold text-[#080083]">
              {(brandingSettings?.schoolName || 'LC').substring(0, 2).toUpperCase()}
            </div>
          )}
          {sidebarOpen && (
            <span className="min-w-0 truncate text-[13px] font-extrabold uppercase tracking-wide text-white">
              {brandingSettings?.schoolName || 'Lions Complex Academy'}
            </span>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 ${sidebarOpen ? 'custom-scrollbar' : 'hide-scrollbar-completely'}`}>
          {ACCOUNTANT_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              {sidebarOpen && (
                <div className="px-2 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/55">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.path || (item.path === 'finance-dashboard' && currentPage === 'dashboard');
                  return (
                    <button
                      key={`${group.label}-${item.label}`}
                      type="button"
                      title={!sidebarOpen ? item.label : undefined}
                      onClick={() => onNavigate(item.path)}
                      onMouseEnter={() => prefetch(item.path)}
                      className={`
                        relative flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left transition-all duration-200
                        ${isActive
                          ? 'bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'}
                      `}
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                        <Icon size={17} strokeWidth={1.9} />
                      </span>
                      {sidebarOpen && (
                        <span className="min-w-0 truncate text-[13px] font-bold">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <footer style={{ backgroundColor: financeDark }} className="flex-shrink-0 border-t border-white/10 p-3">
          {/* <button
            type="button"
            onClick={() => onNavigate('help')}
            className="mb-2 flex h-11 w-full items-center gap-3 rounded-[10px] border border-white/10 px-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <HelpCircle size={17} />
            {sidebarOpen && <span className="text-[12px] font-extrabold">Help & Support</span>}
          </button> */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
            {sidebarOpen && <span className="text-xs font-bold">Collapse</span>}
          </button>
        </footer>
      </aside>
    );
  }

  return (
    <aside
      style={{ width: sidebarW, backgroundColor: theme.bg }}
      className="relative flex flex-col h-full text-white transition-[width] duration-300 ease-in-out border-r border-white/10 shadow-xl flex-shrink-0 z-30"
    >
      {/* ── Logo bar ─────────────────────────────────────────────────────── */}
      <div
        style={{ height: HEADER_H, backgroundColor: theme.dark }}
        className="flex items-center justify-center px-3 border-b border-white/10 overflow-hidden flex-shrink-0"
      >
        {brandingSettings?.logoUrl ? (
          <img
            src={brandingSettings.logoUrl}
            alt="School Logo"
            className={`object-contain transition-all duration-300 ${sidebarOpen ? 'h-11 max-w-full' : 'h-9 w-9'}`}
          />
        ) : sidebarOpen ? (
          <span className="text-base font-semibold text-white tracking-wider truncate text-center leading-tight px-1">
            {brandingSettings?.schoolName || 'ZAWADI'}
          </span>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
            <span className="text-sm font-semibold text-white">
              {(brandingSettings?.schoolName || 'ZA').substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* ── Nav scroll area ──────────────────────────────────────────────── */}
      <nav ref={navScrollRef} className={`flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 ${sidebarOpen ? 'custom-scrollbar' : 'hide-scrollbar-completely'}`}>
        {groupedNav.map((group) => (
          <div key={group.id}>
            {sidebarOpen && group.items.length > 0 && (
              <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/55 flex items-center gap-2">
                {group.icon && <group.icon size={14} className="flex-shrink-0" />}
                <span>{group.label}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((section) => (
                <div
                  key={section.id}
                  ref={(node) => {
                    if (node) sectionRefs.current[section.id] = node;
                    else delete sectionRefs.current[section.id];
                  }}
                >
                  <NavSection
                    section={section}
                    handleSectionClick={handleSectionClick}
                    sidebarOpen={sidebarOpen}
                    currentPage={currentPage}
                    onNavigate={onNavigate}
                    accentColor={theme.accent}
                  />
                </div>
              ))}
            </div>
            {sidebarOpen && group.id !== groupedNav[groupedNav.length - 1].id && (
              <div className="mt-3 mb-1 border-t border-white/10 -mx-2" />
            )}
          </div>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        style={{ backgroundColor: theme.dark }}
        className="flex-shrink-0 border-t border-white/10 px-2 py-2 space-y-0.5"
      >


        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full flex items-center gap-3 px-3 rounded-lg transition-all duration-200 text-white/50 hover:text-white hover:bg-white/10"
          style={{ height: 40 }}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20 }}>
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
          </span>
          {sidebarOpen && <span className="text-xs font-semibold">Collapse</span>}
        </button>
      </footer>
    </aside>
  );
});

// ─── CategoryGroup ────────────────────────────────────────────────────────────
const CategoryGroup = ({ label, sidebarOpen, children }) => (
  <div className="mt-2 pt-2 border-t border-white/10 -mx-2 px-2">
    {sidebarOpen && (
      <div className="w-full flex items-center px-3 pointer-events-none" style={{ height: 36 }}>
        <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/60">{label}</span>
      </div>
    )}
    <div className="space-y-0.5 pt-0.5">{children}</div>
  </div>
);

// ─── SingleItem ───────────────────────────────────────────────────────────────
const SingleItem = ({ section, currentPage, onNavigate, sidebarOpen, accentColor }) => {
  const isActive = currentPage === section.id;
  return (
    <button
      onClick={() => !section.greyedOut && onNavigate(section.id)}
      onMouseEnter={() => prefetch(section.id)}
      disabled={!!section.greyedOut}
      title={!sidebarOpen ? section.label : undefined}
      className={`
        relative w-full flex items-center gap-3 px-3 rounded-lg transition-all duration-300 group
        ${isActive && sidebarOpen  ? 'bg-white/15 text-white font-semibold shadow-sm ring-1 ring-white/20'
        : isActive && !sidebarOpen ? 'bg-white/10'
        : 'text-white/60 hover:text-white hover:bg-white/8'}
        ${section.greyedOut ? 'opacity-40 cursor-not-allowed' : ''}
      `}
      style={{ height: 44 }}
    >
      {isActive && (
        <span
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20 }}>
        <section.icon size={18} className={!sidebarOpen ? `${getCollapsedIconColor(section.id, isActive)} transition-all duration-300` : ''} />
      </span>
      {sidebarOpen && <span className="text-sm font-semibold truncate">{section.label}</span>}
    </button>
  );
};

// ─── NavSection ───────────────────────────────────────────────────────────────
const NavSection = React.memo(({
  section,
  handleSectionClick,
  sidebarOpen,
  currentPage,
  onNavigate,
  accentColor,
  isBottom = false,
}) => {
  const hasChildren = (section.items?.length || 0) > 0;

  const isChildActive = useMemo(() => {
    if (!hasChildren) return false;
    const check = (items) => (items || []).some(i =>
      i.type === 'group' ? check(i.items) : i.path === currentPage
    );
    return check(section.items);
  }, [section.items, currentPage, hasChildren]);

  const isActive     = currentPage === section.id || isChildActive;
  const isAssessment = section.id === 'assessment';
  const isSettings   = section.id === 'settings';

  const [isExpanded, setIsExpanded] = useState(isActive);

  useEffect(() => {
    if (isChildActive && isSettings) setIsExpanded(true);
  }, [isChildActive, isSettings]);

  if (!hasChildren) {
    return (
      <SingleItem
        section={section}
        currentPage={currentPage}
        onNavigate={onNavigate}
        sidebarOpen={sidebarOpen}
        accentColor={accentColor}
      />
    );
  }

  const headerClass = `
    relative w-full flex items-center px-3 rounded-lg transition-all duration-200
    ${isAssessment
      ? (isActive ? 'text-amber-300 bg-amber-500/10' : 'text-amber-400/70')
      : (isActive ? 'text-white bg-white/8' : 'text-white/60')}
    ${section.greyedOut ? 'opacity-40' : ''}
  `;

  const sectionItemsBlock = (
    <div className={`ml-[11px] mt-1 border-l border-white/10 pl-3 space-y-0.5 ${isBottom ? 'mb-2' : 'mb-1'}`}>
      {section.items.map(item => {
        if (item.type === 'group') {
          const isPrimaryGroup =
            section.id === 'assessment' && (item.id === 'group-summative' || item.id === 'group-formative');
          return (
            <div key={item.id} className="mb-2 last:mb-0">
              <div className={`flex items-center gap-1.5 px-2 py-1 tracking-wide ${isPrimaryGroup ? 'text-[11px] font-semibold text-amber-400 tracking-normal' : 'text-[9px] font-semibold text-white/45 uppercase'}`}>
                {item.icon && <item.icon size={11} className={`${isPrimaryGroup ? 'text-amber-400' : 'opacity-70'} flex-shrink-0`} />}
                <span>{item.label}</span>
              </div>
              <div className="ml-1 border-l border-white/10 pl-2 space-y-0.5 pt-0.5">
                {(item.items || []).map(sub => (
                  <LeafItem key={sub.id} item={sub} currentPage={currentPage} onNavigate={onNavigate} accentColor={accentColor} />
                ))}
              </div>
            </div>
          );
        }
        return <LeafItem key={item.id} item={item} currentPage={currentPage} onNavigate={onNavigate} accentColor={accentColor} />;
      })}
    </div>
  );

  return (
    <div>
      {sidebarOpen ? (
        <>
          <div
            className={`${headerClass} ${isSettings ? 'cursor-pointer' : 'pointer-events-none'}`}
            style={{ height: 40 }}
            onClick={() => isSettings && setIsExpanded(!isExpanded)}
            role={isSettings ? 'button' : undefined}
            tabIndex={isSettings ? 0 : -1}
          >
            {isActive && (
              <span
                className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20 }}>
                <section.icon size={18} className={isSettings ? 'text-white' : undefined} />
              </span>
              <span className="text-sm font-semibold truncate text-left flex-1">{section.label}</span>
              {isSettings && (
                <ChevronDown size={14} className={`transition-transform duration-200 text-white/40 ${isExpanded ? 'rotate-180' : ''}`} />
              )}
            </div>
          </div>
          {(!isSettings || isExpanded) && sectionItemsBlock}
        </>
      ) : (
        <button
          type="button"
          onClick={() => !section.greyedOut && handleSectionClick(section)}
          disabled={!!section.greyedOut}
          title={section.label}
          className={`
            relative w-full flex items-center px-3 rounded-lg transition-all duration-300 group
            ${isActive ? 'bg-white/10' : 'hover:bg-white/8'}
            ${section.greyedOut ? 'opacity-40 cursor-not-allowed' : ''}
          `}
          style={{ height: 44 }}
        >
          {isActive && (
            <span
              className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-center">
            <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20 }}>
              <section.icon size={18} className={`${getCollapsedIconColor(section.id, isActive)} transition-all duration-300`} />
            </span>
          </div>
        </button>
      )}
    </div>
  );
});

// ─── LeafItem ─────────────────────────────────────────────────────────────────
const LeafItem = ({ item, currentPage, onNavigate }) => {
  const isActive = currentPage === item.path;
  return (
    <button
      onClick={() => !item.greyedOut && !item.comingSoon && onNavigate(item.path, item.params)}
      onMouseEnter={() => prefetch(item.path)}
      disabled={!!(item.greyedOut || item.comingSoon)}
      className={`
        w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all duration-150
        ${item.greyedOut || item.comingSoon
          ? 'text-white/25 cursor-not-allowed'
          : isActive
            ? 'text-white font-semibold bg-white/10'
            : 'text-white/55 hover:text-white hover:bg-white/5'}
      `}
    >
      <span className="truncate flex-1">{item.label}</span>
      {item.comingSoon && (
        <span className="ml-2 flex-shrink-0 text-[8px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded font-semibold uppercase border border-amber-400/25 tracking-wide">
          Soon
        </span>
      )}
    </button>
  );
};

// ─── display names ────────────────────────────────────────────────────────────
Sidebar.displayName    = 'Sidebar';
NavSection.displayName = 'NavSection';

export default Sidebar;
