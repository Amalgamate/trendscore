import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, HelpCircle, RotateCcw, X } from 'lucide-react';
import { GUIDE_VERSION, findModuleGuide } from './moduleGuides';
import { makeHelpProgressKey, readHelpProgress, writeHelpProgress } from './helpProgress';
import { hasPageAccess } from '../CBCGrading/utils/appAccess';

const ModuleHelpAssistant = ({ currentPage, user, onNavigate }) => {
  const guide = useMemo(() => findModuleGuide(currentPage, user?.role), [currentPage, user?.role]);
  const key = guide ? makeHelpProgressKey('guide', GUIDE_VERSION, user?.id || user?.userId, guide.id) : '';
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    if (!guide) {
      setOpen(false);
      return;
    }
    const saved = readHelpProgress(localStorage, key);
    setProgress(saved.steps || {});
    if (!saved.seen) {
      const timer = window.setTimeout(() => setOpen(true), 700);
      writeHelpProgress(localStorage, key, { ...saved, seen: true, steps: saved.steps || {} });
      return () => window.clearTimeout(timer);
    }
  }, [guide, key]);

  if (!guide) return null;

  const saveProgress = (next) => {
    setProgress(next);
    writeHelpProgress(localStorage, key, { seen: true, steps: next });
  };

  const completed = guide.steps.filter((_, index) => progress[index]).length;
  const reset = () => {
    saveProgress({});
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-[80] flex items-center gap-2 rounded-full bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-blue-800"
        aria-label={`Open help for ${guide.title}`}
      >
        <HelpCircle size={20} /> Help
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/35" role="dialog" aria-modal="true" aria-label={guide.title}>
          <section className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <header className="sticky top-0 z-10 border-b bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Module guide</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{guide.title}</h2>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close help"><X size={20} /></button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(completed / guide.steps.length) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{completed} of {guide.steps.length} steps completed</p>
            </header>

            <div className="space-y-5 p-5">
              <p className="text-sm leading-6 text-slate-700">{guide.summary}</p>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Before you start</p>
                <p className="mt-1 text-sm text-blue-950">{guide.required}</p>
              </div>

              <div className="space-y-3">
                {guide.steps.map((step, index) => {
                  const done = Boolean(progress[index]);
                  return (
                    <div key={step.title} className={`rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
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
                          <h3 className="font-semibold text-slate-900">{index + 1}. {step.title}</h3>
                          <p className="mt-1 text-sm leading-5 text-slate-600">{step.description}</p>
                          {step.page && step.page !== currentPage && (
                            <button disabled={!hasPageAccess(user, step.page)} onClick={() => { onNavigate(step.page); setOpen(false); }} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400">
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
                <h3 className="text-sm font-bold text-slate-900">Good practice</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {guide.tips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              </div>

              <button onClick={reset} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><RotateCcw size={15} /> Restart this guide</button>
              <button onClick={() => { onNavigate('help', { helpQuery: guide.support?.query, helpSection: guide.support?.section }); setOpen(false); }} className="ml-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"><HelpCircle size={15} /> Read detailed help</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default ModuleHelpAssistant;
