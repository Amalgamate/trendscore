import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Home, Gift, Plus } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';

// ── helpers ───────────────────────────────────────────────────────────────────
const flattenLeafItems = (items = []) =>
  items.flatMap((item) => (item.type === 'group' ? (item.items || []) : [item]));

const isItemActive = (item, currentPage, pageParams = {}) => {
  if (currentPage !== item.path) return false;
  const params = item.params || {};
  return Object.entries(params).every(([key, value]) => pageParams?.[key] === value);
};

const PASTEL_PALETTE = {
  'Assessments':        'text-emerald-700 bg-emerald-50',
  'Detailed Reports':   'text-amber-700   bg-amber-50',
  'Reports':            'text-amber-700   bg-amber-50',
  'Core Competencies':  'text-sky-700     bg-sky-50',
  'National Values':    'text-rose-700    bg-rose-50',
  'Co-Curricular':      'text-teal-700    bg-teal-50',
  'Termly Report':      'text-fuchsia-700 bg-fuchsia-50',
  'Official Report Card': 'text-fuchsia-700 bg-fuchsia-50',
  'Learning Areas':     'text-indigo-700  bg-indigo-50',
  'Students List':      'text-blue-700    bg-blue-50',
  'Admissions':         'text-emerald-700 bg-emerald-50',
  'Promotion':          'text-purple-700  bg-purple-50',
  'Tutors List':        'text-blue-700    bg-blue-50',
  'School Settings':    'text-indigo-700  bg-indigo-50',
  'Academic Settings':  'text-purple-700  bg-purple-50',
  'Branding':           'text-emerald-700 bg-emerald-50',
  'Mark Entry':         'text-indigo-700  bg-indigo-50',
  'CATs':               'text-violet-700  bg-violet-50',
  'Mid-term Exams':     'text-emerald-700 bg-emerald-50',
  'End-term Exams':     'text-amber-700   bg-amber-50',
  'Mock Exams':         'text-sky-700     bg-sky-50',
};

const COLOR_CYCLE = [
  'text-indigo-700  bg-indigo-50',
  'text-purple-700  bg-purple-50',
  'text-emerald-700 bg-emerald-50',
  'text-amber-700   bg-amber-50',
  'text-sky-700     bg-sky-50',
  'text-rose-700    bg-rose-50',
  'text-teal-700    bg-teal-50',
  'text-fuchsia-700 bg-fuchsia-50',
];

// These specialised learner operations remain available in the sidebar but do
// not belong in the horizontal learner menu.
const HIDDEN_HORIZONTAL_PATHS = new Set([
  'learners-admissions',
  'learners-promotion',
  'learners-uniform',
  'learners-id-print',
]);

// Full-page create/edit/builder screens that are one level below a visible nav
// tab (e.g. "Create Assignment" lives under the "Assignments" tab) but are not
// themselves listed as leaf nav items. Without this map, the section lookup
// below fails to find a match and the whole horizontal bar disappears while
// on these pages. Mapping each to its parent tab's path keeps the bar visible
// and highlights the tab the page logically belongs to.
const CHILD_PAGE_PARENT = {
  'learning-assignment-create': 'learning-assignments',
  'learning-assignment-edit':   'learning-assignments',
  'learning-lesson-builder':    'learning-lessons',
  'learning-marketplace-create': 'learning-marketplace',
};

const GROUP_COLORS = [
  { trigger: 'text-indigo-700',  activeBg: 'bg-indigo-50',  dot: 'bg-indigo-500',  hover: 'hover:bg-indigo-50'  },
  { trigger: 'text-purple-700',  activeBg: 'bg-purple-50',  dot: 'bg-purple-500',  hover: 'hover:bg-purple-50'  },
  { trigger: 'text-emerald-700', activeBg: 'bg-emerald-50', dot: 'bg-emerald-500', hover: 'hover:bg-emerald-50' },
  { trigger: 'text-amber-700',   activeBg: 'bg-amber-50',   dot: 'bg-amber-500',   hover: 'hover:bg-amber-50'   },
  { trigger: 'text-sky-700',     activeBg: 'bg-sky-50',     dot: 'bg-sky-500',     hover: 'hover:bg-sky-50'     },
  { trigger: 'text-rose-700',    activeBg: 'bg-rose-50',    dot: 'bg-rose-500',    hover: 'hover:bg-rose-50'    },
  { trigger: 'text-teal-700',    activeBg: 'bg-teal-50',    dot: 'bg-teal-500',    hover: 'hover:bg-teal-50'    },
  { trigger: 'text-fuchsia-700', activeBg: 'bg-fuchsia-50', dot: 'bg-fuchsia-500', hover: 'hover:bg-fuchsia-50' },
];

// ── single flat tab button ─────────────────────────────────────────────────────
const NavItem = ({ item, currentPage, pageParams, onNavigate, idx }) => {
  const isActive = isItemActive(item, currentPage, pageParams);
  const colors = PASTEL_PALETTE[item.label] || COLOR_CYCLE[idx % COLOR_CYCLE.length];
  const [fg, bg] = colors.trim().split(/\s+/);

  return (
    <button
      type="button"
      onClick={() => !item.comingSoon && onNavigate(item.path, item.params)}
      disabled={!!item.comingSoon}
      className={`text-xs font-medium px-2.5 py-1.5 rounded-md transition-all hover:opacity-90 ${
        isActive
          ? `${fg} ${bg} font-semibold ring-1 ring-current/10 shadow-sm`
          : item.comingSoon
            ? 'text-gray-300 cursor-not-allowed'
            : `${fg} ${bg}`
      }`}
    >
      {item.label}
    </button>
  );
};

// ── group → portal dropdown ───────────────────────────────────────────────────
// Uses a portal so the menu escapes any overflow:hidden/auto parent containers.
const GroupDropdown = ({ group, currentPage, pageParams, onNavigate, color }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const items = (group.items || []).filter(i => !i.greyedOut);
  const isAnyActive = items.some((item) => isItemActive(item, currentPage, pageParams));

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom, left: rect.left });
    }
    setOpen(v => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Close on scroll/resize so it doesn't float away
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  if (!items.length) return null;

  const dropdownMenu = open ? (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menuPos.top + 4, left: menuPos.left, zIndex: 9999 }}
      className="min-w-[190px] rounded-md border border-gray-200 bg-white p-1 shadow-lg"
    >
      {items.map((item, i) => {
        const isActive = isItemActive(item, currentPage, pageParams);
        return (
          <button
            key={item.id || item.path || i}
            type="button"
            onClick={() => { if (!item.comingSoon) { onNavigate(item.path, item.params); setOpen(false); } }}
            disabled={!!item.comingSoon}
            className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
              isActive
                ? `${color.trigger} ${color.activeBg}`
                : item.comingSoon
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isActive ? color.dot : 'bg-transparent'}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
          isAnyActive
            ? `${color.trigger} ${color.activeBg} font-semibold ring-1 ring-current/10 shadow-sm`
            : `${color.trigger} ${color.activeBg} hover:opacity-90`
        }`}
      >
        {group.label}
        <svg
          className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {typeof document !== 'undefined' && ReactDOM.createPortal(dropdownMenu, document.body)}
    </>
  );
};

const HorizontalSubmenu = ({ currentPage, pageParams, onNavigate }) => {
  const { navSections } = useNavigation();

  // Resolve orphaned builder/create/edit pages to the tab they logically
  // belong under (see CHILD_PAGE_PARENT above) so the bar doesn't vanish.
  const resolvedPage = CHILD_PAGE_PARENT[currentPage] || currentPage;

  const activeSection = useMemo(() => {
    const byPage = (navSections || []).find((section) => {
      const leaves = flattenLeafItems(section.items || []);
      return leaves.some((leaf) => leaf.path === resolvedPage);
    });
    if (byPage) return byPage;
    return (navSections || []).find((s) => s.id === resolvedPage) || null;
  }, [navSections, resolvedPage]);

  const hasGroups = useMemo(
    () => (activeSection?.items || []).some(i => i.type === 'group'),
    [activeSection]
  );

  const flatItems = useMemo(
    () => flattenLeafItems(activeSection?.items || []).filter(i => !i.greyedOut && !HIDDEN_HORIZONTAL_PATHS.has(i.path)),
    [activeSection]
  );

  const canAddLearner = useMemo(
    () => flattenLeafItems(activeSection?.items || []).some((item) => item.path === 'learners-admissions'),
    [activeSection]
  );
  const showLearnerAddAction = activeSection?.id === 'learners' && currentPage === 'learners-list' && canAddLearner;

  const noticesTab = ['notices', 'birthdays', 'changelog'].includes(pageParams?.activeTab)
    ? pageParams.activeTab
    : 'notices';
  const noticeTabs = [
    { id: 'birthdays', label: "This Week's Birthdays", icon: Gift, color: 'text-purple-700', active: 'border-purple-600' },
  ];

  if (!activeSection) return null;
  if (activeSection.hideHorizontalSubmenu) return null;
  if (hasGroups && !(activeSection.items || []).length) return null;
  // A single destination normally does not need a second navigation row.
  // Learners is the exception: admissions is intentionally an inline action
  // here, so retain the bar when it is the only available learner control.
  if (!hasGroups && flatItems.length < 2 && !showLearnerAddAction) return null;

  return (
    <div className="horizontal-menu-shell border-b border-gray-200 bg-gray-100/95 backdrop-blur-md">
      <div className="app-layout-row flex items-center gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap py-2">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          title="Home"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all ${
            currentPage === 'dashboard'
              ? 'bg-blue-50 text-blue-700'
              : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          <Home size={16} />
        </button>
        <span className="h-4 w-px bg-gray-200 mx-2" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mr-2">
          {activeSection.label}
        </span>
        <span className="h-4 w-px bg-gray-200 mr-2" />

        {hasGroups
          ? (activeSection.items || []).map((item, idx) => {
              const isLast = idx === activeSection.items.length - 1;
              if (item.type === 'group') {
                return (
                  <React.Fragment key={item.id || idx}>
                    <GroupDropdown
                      group={item}
                      currentPage={resolvedPage}
                      pageParams={pageParams}
                      onNavigate={onNavigate}
                      color={GROUP_COLORS[idx % GROUP_COLORS.length]}
                    />
                    {!isLast && <span className="h-4 w-px bg-gray-200" />}
                  </React.Fragment>
                );
              }
              if (!item.greyedOut) {
                return (
                  <React.Fragment key={item.id || item.path || idx}>
                    <NavItem item={item} currentPage={resolvedPage} pageParams={pageParams} onNavigate={onNavigate} idx={idx} />
                    {!isLast && <span className="h-4 w-px bg-gray-200" />}
                  </React.Fragment>
                );
              }
              return null;
            })
          : flatItems.map((item, idx) => (
              <React.Fragment key={item.id || item.path || idx}>
                <NavItem item={item} currentPage={resolvedPage} pageParams={pageParams} onNavigate={onNavigate} idx={idx} />
                {idx < flatItems.length - 1 && <span className="h-4 w-px bg-gray-300" />}
              </React.Fragment>
            ))}

        {showLearnerAddAction && (
          <button
            type="button"
            onClick={() => onNavigate('learners-admissions')}
            className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-brand-purple px-2.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30"
          >
            <Plus size={14} />
            Add Student
          </button>
        )}

        {currentPage === 'comm-notices' && (
          <>
            <span className="mx-1 h-4 w-px bg-gray-200" />
            {noticeTabs.map(({ id, label, icon: Icon, color, active }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate('comm-notices', { activeTab: id })}
                className={`flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  noticesTab === id
                    ? `${color} ${active}`
                    : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </>
        )}

      </div>
    </div>
  );
};

export default HorizontalSubmenu;
