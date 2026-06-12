import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Eye, EyeOff, Pin, PinOff, RotateCcw, SlidersHorizontal, X } from 'lucide-react';

const STORAGE_PREFIX = 'treadscore.dashboard.sections.';

const buildDefaultState = (sections) =>
  sections.reduce((acc, section) => {
    acc[section.id] = {
      visible: section.defaultVisible !== false,
      pinned: !!section.defaultPinned,
    };
    return acc;
  }, {});

const mergeState = (sections, storedState = {}) => {
  const defaults = buildDefaultState(sections);
  return Object.keys(defaults).reduce((acc, id) => {
    acc[id] = {
      ...defaults[id],
      ...(storedState[id] || {}),
    };
    return acc;
  }, {});
};

export const useDashboardSections = (dashboardId, sections) => {
  const storageKey = `${STORAGE_PREFIX}${dashboardId}`;
  const sectionSignature = JSON.stringify(
    sections.map(({ id, label, description, defaultVisible, defaultPinned }) => ({
      id,
      label,
      description,
      defaultVisible,
      defaultPinned,
    }))
  );
  const stableSections = useMemo(() => sections, [sectionSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sectionState, setSectionState] = useState(() => {
    if (typeof window === 'undefined') return buildDefaultState(stableSections);
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      return mergeState(stableSections, stored);
    } catch {
      return buildDefaultState(stableSections);
    }
  });

  useEffect(() => {
    setSectionState((current) => mergeState(stableSections, current));
  }, [stableSections]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(sectionState));
  }, [sectionState, storageKey]);

  const toggleVisible = (id) => {
    setSectionState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        visible: !current[id]?.visible,
      },
    }));
  };

  const togglePinned = (id) => {
    setSectionState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        pinned: !current[id]?.pinned,
      },
    }));
  };

  const resetSections = () => setSectionState(buildDefaultState(stableSections));

  const getSectionState = (id) => sectionState[id] || { visible: true, pinned: false };

  return {
    sections: stableSections,
    sectionState,
    getSectionState,
    toggleVisible,
    togglePinned,
    resetSections,
  };
};

export const DashboardSectionControls = ({
  title = 'Dashboard Sections',
  sections,
  sectionState,
  toggleVisible,
  togglePinned,
  resetSections,
  variant = 'floating', // kept for backwards compat — ignored, always renders as modal trigger
}) => {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const modal = open ? ReactDOM.createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]">

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={16} className="text-brand-purple" />
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetSections}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Reset all sections to default"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {sections.map((section) => {
            const state = sectionState[section.id] || { visible: true, pinned: false };
            return (
              <div
                key={section.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{section.label}</p>
                  {section.description && (
                    <p className="text-xs font-medium text-slate-400 mt-0.5 truncate">{section.description}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => togglePinned(section.id)}
                    className={`rounded-lg p-2 transition-colors ${state.pinned ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-white hover:text-slate-700'}`}
                    title={state.pinned ? 'Unpin section' : 'Pin section'}
                  >
                    {state.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisible(section.id)}
                    className={`rounded-lg p-2 transition-colors ${state.visible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                    title={state.visible ? 'Hide section' : 'Show section'}
                  >
                    {state.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => setOpen(false)}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger button — sits inline in the tab row */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-shrink-0 flex items-center justify-center h-full px-4 border-l border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-purple transition-colors"
        aria-label="Dashboard sections"
        title="Customise dashboard sections"
      >
        <SlidersHorizontal size={16} />
      </button>

      {modal}
    </>
  );
};

export const DashboardSection = ({ id, controls, children }) => {
  const state = controls.getSectionState(id);
  if (!state.visible) return null;

  return (
    <section className={`relative ${state.pinned ? 'rounded-2xl ring-2 ring-amber-300 ring-offset-2' : ''}`}>
      {state.pinned && (
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 shadow-sm">
          <Pin size={11} />
          Pinned
        </div>
      )}
      {children}
    </section>
  );
};
