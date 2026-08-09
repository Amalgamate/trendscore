import React, { useEffect, useMemo } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { findRoleOnboarding } from './roleOnboardingJourneys';
import { hasPageAccess } from '../CBCGrading/utils/appAccess';
import './helpDrawers.css';

const RoleOnboarding = ({ currentPage, user, onNavigate, open = false, onOpenChange, progress }) => {
  const journey = useMemo(() => findRoleOnboarding(user?.role, currentPage), [currentPage, user?.role]);

  useEffect(() => {
    if (!journey || !progress?.isFresh) return;
      const timer = window.setTimeout(() => onOpenChange?.(true), 900);
      progress.markSeen();
      return () => window.clearTimeout(timer);
  }, [journey, onOpenChange, progress]);

  if (!journey) return null;
  const visibleSteps = journey.steps.filter((step) => hasPageAccess(user, step.page));
  const completed = visibleSteps.filter((step) => progress?.steps?.[journey.steps.indexOf(step)]).length;

  return (
    <>
      {open && (
        <div onMouseDown={() => onOpenChange?.(false)} className="ts-help-backdrop fixed inset-0 z-[101] flex items-start justify-end bg-slate-950/30 p-3 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={journey.title}>
          <section onMouseDown={(event) => event.stopPropagation()} className="ts-help-drawer flex h-[min(720px,calc(100vh-1.5rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.45)]">
            <header className="border-b border-emerald-600/40 bg-gradient-to-br from-emerald-700 to-emerald-600 px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">Setup journey</p><h2 className="mt-1 text-lg font-bold leading-tight">{journey.title}</h2><p className="mt-1.5 text-xs leading-relaxed text-emerald-50/90">{journey.intro}</p></div>
                <button onClick={() => onOpenChange?.(false)} className="rounded-lg p-1.5 transition-colors hover:bg-white/15" aria-label="Close onboarding"><X size={18} /></button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="ts-help-progress h-full rounded-full bg-white" style={{ width: `${visibleSteps.length ? (completed / visibleSteps.length) * 100 : 0}%` }} /></div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              <div className="mb-3 flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">Progress</span><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500">{completed} of {visibleSteps.length}</span></div>
              <div className="space-y-2.5">
                {visibleSteps.map((step) => {
                  const index = journey.steps.indexOf(step);
                  const done = Boolean(progress?.steps?.[index]);
                  const verified = Boolean(progress?.serverStages?.[step.key]);
                  return (
                    <div key={step.title} style={{ '--step-index': index }} className={`ts-help-step flex gap-2.5 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${done ? 'border-emerald-200 bg-emerald-50/80' : 'border-slate-200 bg-white'}`}>
                      <button disabled={verified} onClick={() => progress?.setStepComplete(index, !done)} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${done ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-300 hover:border-emerald-400'} disabled:cursor-default`} aria-label={`${done ? 'Completed' : 'Mark complete'}: ${step.title}`}>{done && <Check size={13} />}</button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5"><h3 className="text-xs font-bold text-slate-900">{index + 1}. {step.title}</h3>{verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700"><Check size={9} /> Verified</span>}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{step.description}</p>
                      </div>
                      <button onClick={() => { onNavigate(step.page); onOpenChange?.(false); }} className="self-center rounded-lg p-1.5 text-emerald-700 transition-all hover:translate-x-0.5 hover:bg-emerald-100" aria-label={`Go to ${step.title}`}><ChevronRight size={17} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <footer className="border-t border-slate-100 bg-white px-3.5 py-3"><button onClick={() => onOpenChange?.(false)} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md">Continue to dashboard</button></footer>
          </section>
        </div>
      )}
    </>
  );
};

export default RoleOnboarding;
