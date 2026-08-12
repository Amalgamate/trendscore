import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Compass, Sparkles, X } from 'lucide-react';

const GUIDE_VERSION = 'v3';

// ─── Staff (primary / junior school) steps ────────────────────────────────────
const juniorSteps = [
  {
    id: 'classes',
    title: 'Check Grade 7\u20139 learners',
    text: 'Make sure learners are in the right class before starting their transition journey.',
    action: 'Open Transition Readiness',
    path: 'sec-pathway-overview',
  },
  {
    id: 'cases',
    title: 'Review pathway suggestions',
    text: 'Use each learner\u2019s evidence, strengths and interests to guide the conversation.',
    action: 'Review Transition Cases',
    path: 'sec-pathway-counsellor',
  },
  {
    id: 'schools',
    title: 'Explore careers and schools',
    text: 'Connect a learner\u2019s pathway with careers, subject choices and senior-school options.',
    action: 'Open School Catalogue',
    path: 'sec-school-catalogue',
  },
  {
    id: 'family',
    title: 'Invite family input',
    text: 'Parents can share preferences and review the learner\u2019s future plan.',
    action: 'Open Parent pathway view',
    path: 'parent-portal-pathway',
  },
  {
    id: 'decision',
    title: 'Complete the decision',
    text: 'Counsellors review, approve and lock the final learner plan.',
    action: 'Open Transition Cases',
    path: 'sec-pathway-counsellor',
  },
];

// ─── Staff (secondary / senior school) steps ─────────────────────────────────
const seniorSteps = [
  {
    id: 'offerings',
    title: 'Confirm school offerings',
    text: 'Select the pathways and subjects your senior school genuinely provides.',
    action: 'Open Pathway Catalogue',
    path: 'sec-pathways',
  },
  {
    id: 'schools',
    title: 'Keep the school profile current',
    text: 'Verify school details so junior learners and families receive trustworthy matches.',
    action: 'Open School Catalogue',
    path: 'sec-school-catalogue',
  },
  {
    id: 'subjects',
    title: 'Review subjects and combinations',
    text: 'Make sure the catalogue reflects what learners can choose at your school.',
    action: 'Open Subject Catalogue',
    path: 'sec-subjects',
  },
  {
    id: 'progress',
    title: 'Support incoming learners',
    text: 'Use the progress dashboard and counsellor workbench to support choices after admission.',
    action: 'Open Progress Dashboard',
    path: 'sec-pathway-overview',
  },
];

// ─── Admin steps ──────────────────────────────────────────────────────────────
const adminSteps = [
  {
    id: 'offerings',
    title: 'Set up this school’s offerings',
    text: 'Start here. Choose the pathways and subjects the school genuinely teaches, then save. These choices control what can appear in Senior School tests and learner plans.',
    action: 'Open School Offerings',
    path: 'sec-school-offerings',
  },
  {
    id: 'catalogue',
    title: 'Prepare trusted pathway content',
    text: 'Maintain the shared pathways, tracks, combinations and careers that students and families will see. Publish only accurate content.',
    action: 'Open Content',
    path: 'pathways-admin',
    params: { tab: 'content' },
  },
  {
    id: 'schools',
    title: 'Verify senior schools',
    text: 'Check senior-school profiles and availability so the families’ school matches are reliable.',
    action: 'Open Senior Schools',
    path: 'pathways-admin',
    params: { tab: 'schools' },
  },
  {
    id: 'readiness',
    title: 'Monitor learner readiness',
    text: 'Use Overview to see class readiness. Then open Workbench for a learner who needs support, review their evidence and guide the next step with the teacher and family.',
    action: 'Open Overview',
    path: 'pathways-admin',
    params: { tab: 'dashboard' },
  },
  {
    id: 'workbench',
    title: 'Handle learner cases',
    text: 'In Workbench, review a learner’s pathway recommendation, interests, careers and school options. Capture a clear plan before asking the parent to review it.',
    action: 'Open Workbench',
    path: 'sec-pathway-counsellor',
  },
  {
    id: 'quality',
    title: 'Check data quality',
    text: 'Resolve missing or inconsistent data before it influences a learner recommendation or a parent conversation.',
    action: 'Open Data Quality',
    path: 'pathways-admin',
    params: { tab: 'quality' },
  },
  {
    id: 'insights',
    title: 'Review transition insights',
    text: 'Use analytics to spot demand, delayed decisions and groups of learners who need support. Adjust your school plan from the evidence.',
    action: 'Open Analytics',
    path: 'pathways-admin',
    params: { tab: 'analytics' },
  },
];

// ─── Parent (junior transition) steps ────────────────────────────────────────
// These navigate parents through their own portal screens only — no staff-only routes.
const parentJuniorSteps = [
  {
    id: 'recommendation',
    title: 'Understand the pathway suggestion',
    text: 'The system has looked at your child\u2019s grades, competency ratings and interests to suggest a learning pathway \u2014 STEM, Social Sciences, or Arts & Sports Science. Open the pathway view to see the result and what it means for your child\u2019s future.',
    action: 'Open Pathway View',
    path: 'parent-portal-pathway',
  },
  {
    id: 'careers',
    title: 'Explore careers together',
    text: 'Browse careers that match the suggested pathway. Mark the ones that interest your family and add a note \u2014 your feedback goes directly to the school counsellor as part of the planning conversation.',
    action: 'View Careers',
    path: 'parent-portal-pathway',
  },
  {
    id: 'preferences',
    title: 'Share what matters to your family',
    text: 'Tell us your budget range, whether you prefer day or boarding, the counties you are considering, and any other requirements. This is used to find senior schools that are a genuine fit for your child and your family.',
    action: 'Set Family Preferences',
    path: 'parent-portal-pathway',
  },
  {
    id: 'schools',
    title: 'Build a school shortlist',
    text: 'Browse senior schools matched to your child\u2019s pathway and your family\u2019s preferences. Save the schools you want to consider and rank them in order. Your counsellor will use this list when preparing the final plan.',
    action: 'Open School Shortlist',
    path: 'parent-portal-schools',
  },
  {
    id: 'decision',
    title: 'Review and sign off the plan',
    text: 'When the counsellor has prepared the final transition plan \u2014 covering pathway, subjects, career directions and school choices \u2014 you will be asked to review it and give your approval before it is locked.',
    action: 'View Decision Plan',
    path: 'parent-portal-pathway',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleKey = (user = {}) => String(user?.role || 'STAFF').toUpperCase();
const storageKey = (user) =>
  `trendscore_pathway_guide_${GUIDE_VERSION}_${roleKey(user)}_${String(user?.institutionType || 'PRIMARY_CBC').toUpperCase()}`;

export const getPathwayGuide = (user) => {
  const role = roleKey(user);

  // Parents get their own family-facing guide, not the staff workflow.
  if (role === 'PARENT') {
    return {
      title: 'Junior Transition Guide',
      intro:
        'Help your child move from junior school to the right senior school, one step at a time.',
      steps: parentJuniorSteps,
    };
  }

  if (['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(role)) {
    const isSecondary = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';
    return {
      title: isSecondary ? 'Senior Pathway Admin Workflow' : 'Junior Transition Admin Workflow',
      intro: isSecondary
        ? 'Set up the subjects your senior school delivers, then use readiness and the workbench to support every learner, teacher and parent conversation.'
        : 'Use evidence, careers and senior-school information to help each Grade 7–9 learner make a confident transition decision with their family.',
      steps: isSecondary ? adminSteps : adminSteps.filter((step) => step.id !== 'offerings'),
    };
  }

  if (String(user?.institutionType || '').toUpperCase() === 'SECONDARY') {
    return {
      title: 'Senior School Guide',
      intro: 'Set up your school\u2019s real offerings and support learners as they settle into their pathway.',
      steps: seniorSteps,
    };
  }

  return {
    title: 'Junior Transition Guide',
    intro: 'Take learners from readiness to a confident senior-school decision, one clear step at a time.',
    steps: juniorSteps,
  };
};

const readProgress = (user) => {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(user)) || '{}');
  } catch {
    return {};
  }
};

const writeProgress = (user, value) =>
  window.localStorage.setItem(storageKey(user), JSON.stringify(value));

// ─── PathwayGuideWelcome — dismissible onboarding banner ─────────────────────

export function PathwayGuideWelcome({ user, onNavigate }) {
  const [visible, setVisible] = useState(false);
  const guide = useMemo(() => getPathwayGuide(user), [user]);

  useEffect(() => {
    const saved = readProgress(user);
    setVisible(!saved.dismissed && !saved.started);
  }, [user]);

  if (!visible) return null;

  const isParent = roleKey(user) === 'PARENT';
  const isSecondary = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4" aria-label="Pathway guide welcome">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-600 p-2 text-white">
          <Sparkles size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-indigo-950">
            {isParent
              ? 'Not sure where to start?'
              : isSecondary
                ? 'New to the Senior Pathway Centre?'
                : 'New to the Junior Transition Centre?'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-900">{guide.intro}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                writeProgress(user, { ...readProgress(user), started: true });
                onNavigate?.('pathway-guide');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Compass size={14} aria-hidden="true" />
              {isParent ? 'Guide me through it' : 'Guide me'}
            </button>
            <button
              type="button"
              onClick={() => {
                writeProgress(user, { ...readProgress(user), dismissed: true });
                setVisible(false);
              }}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
            >
              Skip for now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            writeProgress(user, { ...readProgress(user), dismissed: true });
            setVisible(false);
          }}
          className="text-indigo-400 hover:text-indigo-700"
          aria-label="Dismiss pathway guide"
        >
          <X size={16} />
        </button>
      </div>
    </section>
  );
}

// ─── PathwayGuide — full-page step checklist ─────────────────────────────────

export default function PathwayGuide({ user, onNavigate }) {
  const guide = useMemo(() => getPathwayGuide(user), [user]);
  const [progress, setProgress] = useState(() => readProgress(user));
  const completed = new Set(progress.completed || []);

  const update = (next) => {
    setProgress(next);
    writeProgress(user, next);
  };

  const toggle = (id) => {
    const nextCompleted = completed.has(id)
      ? [...completed].filter((item) => item !== id)
      : [...completed, id];
    update({ ...progress, started: true, completed: nextCompleted });
  };

  const openStep = (step) => {
    const next = {
      ...progress,
      started: true,
      completed: completed.has(step.id) ? [...completed] : [...completed, step.id],
    };
    update(next);
    onNavigate?.(step.path, step.params || {});
  };

  const reset = () => update({ started: true, completed: [], dismissed: false });

  const percent = guide.steps.length
    ? Math.round((completed.size / guide.steps.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 pb-12">
      {/* Hero header */}
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-700 to-violet-700 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <Compass size={13} aria-hidden="true" /> Pathway Guide
            </div>
            <h1 className="text-2xl font-black">{guide.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-indigo-100">{guide.intro}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10"
          >
            Start again
          </button>
        </div>
        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs font-semibold text-indigo-100">
            <span>Your progress</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-black text-gray-900">Follow these steps</h2>
        <p className="mt-1 text-sm text-gray-600">
          You can skip, return, or repeat any step whenever you need to.
        </p>
        <ol className="mt-5 space-y-3">
          {guide.steps.map((step, index) => {
            const isDone = completed.has(step.id);
            return (
              <li
                key={step.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
                  isDone ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  aria-label={`Mark ${step.title} as ${isDone ? 'not done' : 'done'}`}
                  className={isDone ? 'text-emerald-600' : 'text-gray-300 hover:text-indigo-600'}
                >
                  {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-black text-gray-900">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{step.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openStep(step)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  {step.action}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
