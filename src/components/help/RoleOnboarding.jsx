import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Compass, X } from 'lucide-react';
import { findRoleOnboarding, ONBOARDING_VERSION } from './roleOnboardingJourneys';
import { makeHelpProgressKey, readHelpProgress, writeHelpProgress } from './helpProgress';
import { hasPageAccess } from '../CBCGrading/utils/appAccess';

const RoleOnboarding = ({ currentPage, user, onNavigate }) => {
  const journey = useMemo(() => findRoleOnboarding(user?.role, currentPage), [currentPage, user?.role]);
  const key = journey ? makeHelpProgressKey('onboarding', ONBOARDING_VERSION, user?.id || user?.userId, journey.id) : '';
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState({});

  useEffect(() => {
    if (!journey) return;
    const saved = readHelpProgress(localStorage, key);
    setSteps(saved.steps || {});
    if (!saved.seen) {
      const timer = window.setTimeout(() => setOpen(true), 900);
      writeHelpProgress(localStorage, key, { seen: true, steps: saved.steps || {} });
      return () => window.clearTimeout(timer);
    }
  }, [journey, key]);

  if (!journey) return null;
  const visibleSteps = journey.steps.filter((step) => hasPageAccess(user, step.page));
  const completed = visibleSteps.filter((step) => steps[journey.steps.indexOf(step)]).length;
  const save = (next) => {
    setSteps(next);
    writeHelpProgress(localStorage, key, { seen: true, steps: next });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-24 right-5 z-[79] flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-emerald-800" aria-label="Open getting started guide">
        <Compass size={20} /> Getting started
      </button>
      {open && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={journey.title}>
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="border-b bg-emerald-700 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Your setup journey</p><h2 className="mt-1 text-2xl font-bold">{journey.title}</h2><p className="mt-2 text-sm text-emerald-50">{journey.intro}</p></div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/15" aria-label="Close onboarding"><X size={21} /></button>
              </div>
            </header>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">Progress</span><span className="text-slate-500">{completed} of {visibleSteps.length}</span></div>
              <div className="space-y-3">
                {visibleSteps.map((step) => {
                  const index = journey.steps.indexOf(step);
                  const done = Boolean(steps[index]);
                  return (
                    <div key={step.title} className={`flex gap-3 rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
                      <button onClick={() => save({ ...steps, [index]: !done })} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`} aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${step.title}`}>{done && <Check size={15} />}</button>
                      <div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{index + 1}. {step.title}</h3><p className="mt-1 text-sm text-slate-600">{step.description}</p></div>
                      <button onClick={() => { onNavigate(step.page); setOpen(false); }} className="self-center rounded-lg p-2 text-emerald-700 hover:bg-emerald-100" aria-label={`Go to ${step.title}`}><ChevronRight size={20} /></button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end"><button onClick={() => setOpen(false)} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Continue to dashboard</button></div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default RoleOnboarding;
