import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pin, PinOff, RotateCcw, SlidersHorizontal } from 'lucide-react';

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
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setOpen(false), 4500);
    return () => window.clearTimeout(timer);
  }, [open, sectionState]);

  return (
    <div className="fixed right-0 top-32 z-40 hidden xl:block">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-l-none border border-r-0 border-slate-200 bg-white/95 px-2 py-3 text-slate-700 shadow-lg backdrop-blur transition hover:bg-brand-purple hover:text-white"
          title="Open dashboard sections"
          aria-label="Open dashboard sections"
        >
          <ChevronLeft size={16} />
          <SlidersHorizontal size={16} />
        </button>
      )}

      <aside
        className={`w-72 rounded-l-2xl border border-r-0 border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
        onMouseEnter={() => setOpen(true)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-brand-purple" />
            <h2 className="text-sm font-extrabold text-slate-950">{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetSections}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Reset sections"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Close sections"
              aria-label="Close sections"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-[calc(100vh-190px)] space-y-2 overflow-y-auto pr-1">
          {sections.map((section) => {
            const state = sectionState[section.id] || { visible: true, pinned: false };
            return (
              <div key={section.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-800">{section.label}</p>
                    {section.description && <p className="truncate text-[10px] font-medium text-slate-500">{section.description}</p>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => togglePinned(section.id)}
                      className={`rounded-md p-1.5 transition ${state.pinned ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-white hover:text-slate-700'}`}
                      title={state.pinned ? 'Unpin section' : 'Pin section'}
                    >
                      {state.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleVisible(section.id)}
                      className={`rounded-md p-1.5 transition ${state.visible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                      title={state.visible ? 'Hide section' : 'Show section'}
                    >
                      {state.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
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
