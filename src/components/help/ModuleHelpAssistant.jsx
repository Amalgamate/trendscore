import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, HelpCircle, RotateCcw, X } from 'lucide-react';
import { GUIDE_VERSION, findModuleGuide } from './moduleGuides';
import { makeHelpProgressKey, readHelpProgress, writeHelpProgress } from './helpProgress';
import { hasPageAccess } from '../CBCGrading/utils/appAccess';
import './helpDrawers.css';

const ModuleHelpAssistant = ({ currentPage, user, onNavigate, open = false, onOpenChange }) => {
  const guide = useMemo(() => findModuleGuide(currentPage, user?.role), [currentPage, user?.role]);
  const key = guide ? makeHelpProgressKey('guide', GUIDE_VERSION, user?.id || user?.userId, guide.id) : '';
  const [progress, setProgress] = useState({});

  useEffect(() => {
    if (!guide) {
      onOpenChange?.(false);
      return;
    }
    const saved = readHelpProgress(localStorage, key);
    setProgress(saved.steps || {});
  }, [guide, key, onOpenChange]);

  useEffect(() => {
    if (!guide || !open) return;
    const saved = readHelpProgress(localStorage, key);
    writeHelpProgress(localStorage, key, { ...saved, used: true, steps: saved.steps || progress });
  }, [guide, key, open, progress]);

  if (!guide) return null;

  const saveProgress = (next) => {
    setProgress(next);
    const saved = readHelpProgress(localStorage, key);
    writeHelpProgress(localStorage, key, { ...saved, used: true, steps: next });
  };

  const completed = guide.steps.filter((_, index) => progress[index]).length;
  const reset = () => {
    saveProgress({});
  };

  return (
    <>
      {open && (
        <div onMouseDown={() => onOpenChange?.(false)} className="ts-help-backdrop fixed inset-0 z-[100] flex items-start justify-end bg-slate-950/25 p-3 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={guide.title}>
          <section onMouseDown={(event) => event.stopPropagation()} className="ts-help-drawer flex h-[min(720px,calc(100vh-1.5rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.45)]">
            <header className="border-b bg-white px-4 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">Module guide</p>
                  <h2 className="mt-1 text-lg font-bold leading-tight text-slate-900">{guide.title}</h2>
                </div>
                <button onClick={() => onOpenChange?.(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close help"><X size={20} /></button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="ts-help-progress h-full rounded-full bg-emerald-500" style={{ width: `${(completed / guide.steps.length) * 100}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{completed} of {guide.steps.length} steps completed</p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
              <p className="text-xs leading-relaxed text-slate-700">{guide.summary}</p>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Before you start</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-950">{guide.required}</p>
              </div>

              <div className="space-y-3">
                {guide.steps.map((step, index) => {
                  const done = Boolean(progress[index]);
                  return (
                    <div key={step.title} style={{ '--step-index': index }} className={`ts-help-step rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${done ? 'border-emerald-200 bg-emerald-50/80' : 'border-slate-200'}`}>
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => saveProgress({ ...progress, [index]: !done })}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}
                          aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${step.title}`}
                        >
                          {done && <Check size={14} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-semibold text-slate-900">{index + 1}. {step.title}</h3>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{step.description}</p>
                          {step.page && step.page !== currentPage && (
                            <button disabled={!hasPageAccess(user, step.page)} onClick={() => { onNavigate(step.page); onOpenChange?.(false); }} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 transition-all hover:translate-x-0.5 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400">
                              Go to this page <ChevronRight size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900">Good practice</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-slate-600">
                  {guide.tips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                <button onClick={reset} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900"><RotateCcw size={13} /> Restart guide</button>
                <button onClick={() => { onNavigate('help', { helpQuery: guide.support?.query, helpSection: guide.support?.section }); onOpenChange?.(false); }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900"><HelpCircle size={13} /> Detailed help</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default ModuleHelpAssistant;
