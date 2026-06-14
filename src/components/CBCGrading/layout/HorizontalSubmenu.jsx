import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigation } from '../hooks/useNavigation';
import { useFeeActions } from '../../../contexts/FeeActionsContext';
import { Plus, Upload, Download, Search, ChevronDown, BarChart3, Users } from 'lucide-react';
import SmartLearnerSearch from '../shared/SmartLearnerSearch';

// ── helpers ───────────────────────────────────────────────────────────────────
const flattenLeafItems = (items = []) =>
  items.flatMap((item) => (item.type === 'group' ? (item.items || []) : [item]));

const PASTEL_PALETTE = {
  'Assessments':        'text-emerald-700 bg-emerald-50',
  'Assessment Matrix':  'text-purple-700  bg-purple-50',
  'Detailed Reports':   'text-amber-700   bg-amber-50',
  'Reports':            'text-amber-700   bg-amber-50',
  'Core Competencies':  'text-sky-700     bg-sky-50',
  'National Values':    'text-rose-700    bg-rose-50',
  'Co-Curricular':      'text-teal-700    bg-teal-50',
  'Termly Report':      'text-fuchsia-700 bg-fuchsia-50',
  'Learning Areas':     'text-indigo-700  bg-indigo-50',
  'Students List':      'text-blue-700    bg-blue-50',
  'Admissions':         'text-emerald-700 bg-emerald-50',
  'Promotion':          'text-purple-700  bg-purple-50',
  'Tutors List':        'text-blue-700    bg-blue-50',
  'School Settings':    'text-indigo-700  bg-indigo-50',
  'Academic Settings':  'text-purple-700  bg-purple-50',
  'Branding':           'text-emerald-700 bg-emerald-50',
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
const NavItem = ({ item, currentPage, onNavigate, idx }) => {
  const isActive = currentPage === item.path;
  const colors = PASTEL_PALETTE[item.label] || COLOR_CYCLE[idx % COLOR_CYCLE.length];
  const [fg, bg] = colors.trim().split(/\s+/);

  return (
    <button
      type="button"
      onClick={() => !item.comingSoon && onNavigate(item.path, item.params)}
      disabled={!!item.comingSoon}
      className={`text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${
        isActive
          ? `${fg} ${bg}`
          : item.comingSoon
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {item.label}
    </button>
  );
};

// ── group → portal dropdown ───────────────────────────────────────────────────
// Uses a portal so the menu escapes any overflow:hidden/auto parent containers.
const GroupDropdown = ({ group, currentPage, onNavigate, color }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const items = (group.items || []).filter(i => !i.greyedOut);
  const isAnyActive = items.some(i => i.path === currentPage);

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
      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
      className="bg-white border border-gray-200 shadow-sm min-w-[250px] py-1"
    >
      {items.map((item, i) => {
        const isActive = currentPage === item.path;
        return (
          <button
            key={item.id || item.path || i}
            type="button"
            onClick={() => { if (!item.comingSoon) { onNavigate(item.path, item.params); setOpen(false); } }}
            disabled={!!item.comingSoon}
            className={`w-full text-left px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-3 ${
              isActive
                ? `${color.trigger} bg-gray-50`
                : item.comingSoon
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-black hover:bg-gray-50'
            }`}
          >
            {isActive && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />}
            <span className={isActive ? '' : 'ml-5'}>{item.label}</span>
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
        className={`flex items-center gap-2 text-sm font-medium px-3 py-2 border transition-all ${
          isAnyActive
            ? `${color.trigger} ${color.activeBg} border-gray-900`
            : `text-black hover:text-gray-900 border-transparent ${color.hover}`
        }`}
      >
        {group.label}
        {isAnyActive && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />}
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

const HorizontalSubmenu = ({ currentPage, onNavigate }) => {
  const { navSections } = useNavigation();
  const { feeActions } = useFeeActions();

  // Show fee action links only while on the fee collection page
  const showFeeActions = [
    'fees-overview',
    'fees-structure',
    'fees-types',
    'fees-waivers',
    'fees-statements',
    'fees-unmatched'
  ].includes(currentPage) && feeActions;

  const activeSection = useMemo(() => {
    const byPage = (navSections || []).find((section) => {
      const leaves = flattenLeafItems(section.items || []);
      return leaves.some((leaf) => leaf.path === currentPage);
    });
    if (byPage) return byPage;
    return (navSections || []).find((s) => s.id === currentPage) || null;
  }, [navSections, currentPage]);

  const hasGroups = useMemo(
    () => (activeSection?.items || []).some(i => i.type === 'group'),
    [activeSection]
  );

  const flatItems = useMemo(
    () => flattenLeafItems(activeSection?.items || []).filter(i => !i.greyedOut),
    [activeSection]
  );

  if (!activeSection) return null;
  if (activeSection.hideHorizontalSubmenu) return null;
  if (hasGroups && !(activeSection.items || []).length) return null;
  if (!hasGroups && !flatItems.length) return null;

  return (
    <div className="border-b border-gray-200 bg-gray-100/95 backdrop-blur-md">
      <div className="app-layout-row flex items-center gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap py-2">
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
                      currentPage={currentPage}
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
                    <NavItem item={item} currentPage={currentPage} onNavigate={onNavigate} idx={idx} />
                    {!isLast && <span className="h-4 w-px bg-gray-200" />}
                  </React.Fragment>
                );
              }
              return null;
            })
          : flatItems.map((item, idx) => (
              <React.Fragment key={item.id || item.path || idx}>
                <NavItem item={item} currentPage={currentPage} onNavigate={onNavigate} idx={idx} />
                {idx < flatItems.length - 1 && <span className="h-4 w-px bg-gray-300" />}
              </React.Fragment>
            ))}

        {/* ── Fee collection action links — right-aligned ─────────────── */}
        {showFeeActions && (
          <>
            {/* Metrics Toggle */}
            {feeActions.metricsProps && (
              <button
                onClick={feeActions.metricsProps.toggle}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  feeActions.metricsProps.show 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <BarChart3 size={14} />
                Metrics
                <ChevronDown 
                  size={14} 
                  className={`transition-transform duration-200 ${feeActions.metricsProps.show ? 'rotate-180' : ''}`} 
                />
              </button>
            )}

            {/* Student Search Integration */}
            {feeActions.searchProps && (
              <div className="mx-4 min-w-[320px] flex-1 relative z-50">
                <SmartLearnerSearch
                  learners={feeActions.searchProps.learners}
                  selectedLearnerId={feeActions.searchProps.selectedLearnerId}
                  onSelect={feeActions.searchProps.onSelect}
                  placeholder="Student search..."
                  compact={true}
                />
              </div>
            )}

            <span className="h-4 w-px bg-gray-200 ml-auto mr-1" />

            {/* Create Invoice */}
            <button
              type="button"
              onClick={feeActions.onCreate}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
              title="Create Invoice"
            >
              <Plus size={13} strokeWidth={2.5} />
              New Invoice
            </button>

            {feeActions.onBulkCreate && (
              <>
                <span className="h-4 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={feeActions.onBulkCreate}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Bulk Create Invoices"
                >
                  <Users size={13} strokeWidth={2.5} />
                  Bulk Invoices
                </button>
              </>
            )}

            <span className="h-4 w-px bg-gray-200" />

            {feeActions.onImport && (
              <>
                {/* Import Fees */}
                <button
                  type="button"
                  onClick={feeActions.onImport}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Import Fees"
                >
                  <Upload size={13} strokeWidth={2.5} />
                  Import
                </button>
                <span className="h-4 w-px bg-gray-200" />
              </>
            )}

            {/* Export Data */}
            {feeActions.onExport && (
              <button
                type="button"
                onClick={feeActions.onExport}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                title="Export Data to Excel"
              >
                <Download size={13} strokeWidth={2.5} />
                Export
              </button>
            )}

            {feeActions.onExportPdf && (
              <>
                <span className="h-4 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={feeActions.onExportPdf}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Download PDF"
                >
                  <Download size={13} strokeWidth={2.5} />
                  PDF
                </button>
              </>
            )}

            {feeActions.onExportExcel && (
              <>
                <span className="h-4 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={feeActions.onExportExcel}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 transition-colors"
                  title="Download Excel"
                >
                  <Download size={13} strokeWidth={2.5} />
                  Excel
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HorizontalSubmenu;
