import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Compass, Sparkles, X } from 'lucide-react';

const GUIDE_VERSION = 'v1';

const juniorSteps = [
  { id: 'classes', title: 'Check Grade 7–9 learners', text: 'Make sure learners are in the right class before starting their transition journey.', action: 'Open Transition Readiness', path: 'sec-pathway-overview' },
  { id: 'cases', title: 'Review pathway suggestions', text: 'Use each learner’s evidence, strengths and interests to guide the conversation.', action: 'Review Transition Cases', path: 'sec-pathway-counsellor' },
  { id: 'schools', title: 'Explore careers and schools', text: 'Connect a learner’s pathway with careers, subject choices and senior-school options.', action: 'Open School Catalogue', path: 'sec-school-catalogue' },
  { id: 'family', title: 'Invite family input', text: 'Parents can share preferences and review the learner’s future plan.', action: 'Open Parent pathway view', path: 'parent-portal-pathway' },
  { id: 'decision', title: 'Complete the decision', text: 'Counsellors review, approve and lock the final learner plan.', action: 'Open Transition Cases', path: 'sec-pathway-counsellor' },
];

const seniorSteps = [
  { id: 'offerings', title: 'Confirm school offerings', text: 'Select the pathways and subjects your senior school genuinely provides.', action: 'Open Pathway Catalogue', path: 'sec-pathways' },
  { id: 'schools', title: 'Keep the school profile current', text: 'Verify school details so junior learners and families receive trustworthy matches.', action: 'Open School Catalogue', path: 'sec-school-catalogue' },
  { id: 'subjects', title: 'Review subjects and combinations', text: 'Make sure the catalogue reflects what learners can choose at your school.', action: 'Open Subject Catalogue', path: 'sec-subjects' },
  { id: 'progress', title: 'Support incoming learners', text: 'Use the progress dashboard and counsellor workbench to support choices after admission.', action: 'Open Progress Dashboard', path: 'sec-pathway-overview' },
];

const adminSteps = [
  { id: 'catalogue', title: 'Prepare the catalogue', text: 'Maintain pathways, careers, subject combinations and trusted senior-school data.', action: 'Open Configurations', path: 'pathways-admin', params: { tab: 'content' } },
  { id: 'schools', title: 'Verify senior schools', text: 'Review schools, their available pathways and the information families will see.', action: 'Open Senior Schools', path: 'pathways-admin', params: { tab: 'schools' } },
  { id: 'quality', title: 'Check data quality', text: 'Resolve incomplete data before it influences learner recommendations.', action: 'Open Data Quality', path: 'pathways-admin', params: { tab: 'quality' } },
  { id: 'insights', title: 'Review transition insights', text: 'Use analytics to understand demand, decisions and areas that need support.', action: 'Open Analytics', path: 'pathways-admin', params: { tab: 'analytics' } },
];

const roleKey = (user = {}) => String(user?.role || 'STAFF').toUpperCase();
const storageKey = (user) => `trendscore_pathway_guide_${GUIDE_VERSION}_${roleKey(user)}_${String(user?.institutionType || 'PRIMARY_CBC').toUpperCase()}`;

export const getPathwayGuide = (user) => {
  const role = roleKey(user);
  if (['SUPER_ADMIN', 'ADMIN'].includes(role)) return { title: 'Pathway Guide', intro: 'Set up trusted catalogue data and help every school make good decisions.', steps: adminSteps };
  if (String(user?.institutionType || '').toUpperCase() === 'SECONDARY') return { title: 'Senior School Guide', intro: 'Set up your school’s real offerings and support learners as they settle into their pathway.', steps: seniorSteps };
  return { title: 'Junior Transition Guide', intro: 'Take learners from readiness to a confident senior-school decision, one clear step at a time.', steps: juniorSteps };
};

const readProgress = (user) => {
  try { return JSON.parse(window.localStorage.getItem(storageKey(user)) || '{}'); } catch { return {}; }
};

const writeProgress = (user, value) => window.localStorage.setItem(storageKey(user), JSON.stringify(value));

export function PathwayGuideWelcome({ user, onNavigate }) {
  const [visible, setVisible] = useState(false);
  const guide = useMemo(() => getPathwayGuide(user), [user]);

  useEffect(() => {
    const saved = readProgress(user);
    setVisible(!saved.dismissed && !saved.started);
  }, [user]);

  if (!visible) return null;
  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4" aria-label="Pathway guide welcome">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-600 p-2 text-white"><Sparkles size={18} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-indigo-950">New to the Transition Centre?</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-900">{guide.intro}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { writeProgress(user, { ...readProgress(user), started: true }); onNavigate?.('pathway-guide'); }} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"><Compass size={14} /> Guide me</button>
            <button type="button" onClick={() => { writeProgress(user, { ...readProgress(user), dismissed: true }); setVisible(false); }} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">Skip for now</button>
          </div>
        </div>
        <button type="button" onClick={() => { writeProgress(user, { ...readProgress(user), dismissed: true }); setVisible(false); }} className="text-indigo-400 hover:text-indigo-700" aria-label="Dismiss pathway guide"><X size={16} /></button>
      </div>
    </section>
  );
}

export default function PathwayGuide({ user, onNavigate }) {
  const guide = useMemo(() => getPathwayGuide(user), [user]);
  const [progress, setProgress] = useState(() => readProgress(user));
  const completed = new Set(progress.completed || []);

  const update = (next) => { setProgress(next); writeProgress(user, next); };
  const toggle = (id) => {
    const nextCompleted = completed.has(id) ? [...completed].filter((item) => item !== id) : [...completed, id];
    update({ ...progress, started: true, completed: nextCompleted });
  };
  const openStep = (step) => {
    const next = { ...progress, started: true, completed: completed.has(step.id) ? [...completed] : [...completed, step.id] };
    update(next);
    onNavigate?.(step.path, step.params || {});
  };
  const reset = () => update({ started: true, completed: [], dismissed: false });
  const percent = guide.steps.length ? Math.round((completed.size / guide.steps.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 pb-12">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-700 to-violet-700 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest"><Compass size={13} /> Pathway Guide</div><h1 className="text-2xl font-black">{guide.title}</h1><p className="mt-2 max-w-2xl text-sm text-indigo-100">{guide.intro}</p></div>
          <button type="button" onClick={reset} className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10">Start again</button>
        </div>
        <div className="mt-5"><div className="mb-1 flex justify-between text-xs font-semibold text-indigo-100"><span>Your progress</span><span>{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${percent}%` }} /></div></div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-black text-gray-900">Follow these steps</h2>
        <p className="mt-1 text-sm text-gray-600">You can skip, return, or repeat any step whenever you need to.</p>
        <ol className="mt-5 space-y-3">
          {guide.steps.map((step, index) => {
            const isDone = completed.has(step.id);
            return <li key={step.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${isDone ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
              <button type="button" onClick={() => toggle(step.id)} aria-label={`Mark ${step.title} as ${isDone ? 'not done' : 'done'}`} className={isDone ? 'text-emerald-600' : 'text-gray-300 hover:text-indigo-600'}>{isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}</button>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Step {index + 1}</p><h3 className="mt-1 text-sm font-black text-gray-900">{step.title}</h3><p className="mt-1 text-xs leading-relaxed text-gray-600">{step.text}</p></div>
              <button type="button" onClick={() => openStep(step)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">{step.action}<ArrowRight size={14} /></button>
            </li>;
          })}
        </ol>
      </section>
    </div>
  );
}
