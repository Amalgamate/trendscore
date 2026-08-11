import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, ClipboardList, Heart, Loader2, School, Sparkles } from 'lucide-react';
import { careerAPI, pathwayPlannerAPI } from '../../../services/api';
import PathwayConversation from './PathwayConversation';

export default function StudentPathwayWorkspace({ learnerId, recommendation, selection, mode = 'student', stage = 'senior', summaryOnly = false, refreshKey = 0 }) {
  const [plan, setPlan] = useState(null);
  const [careers, setCareers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [profile, setProfile] = useState(null);
  const [participantProgress, setParticipantProgress] = useState({ sessions: [], interventions: [] });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    const [planResult, careerResult, schoolResult, progressResult, profileResult] = await Promise.allSettled([
      pathwayPlannerAPI.getDecisionPlan(learnerId), careerAPI.getSavedCareers(learnerId), pathwayPlannerAPI.getSchoolPreferences(learnerId), pathwayPlannerAPI.getParticipantProgress(learnerId),
      stage === 'junior' ? pathwayPlannerAPI.getPathwayProfile(learnerId) : Promise.resolve(null),
    ]);
    if (planResult.status === 'fulfilled') setPlan(planResult.value?.data || null);
    if (careerResult.status === 'fulfilled') setCareers(careerResult.value?.data || []);
    if (schoolResult.status === 'fulfilled') setSchools(schoolResult.value?.data || []);
    if (progressResult.status === 'fulfilled') setParticipantProgress(progressResult.value?.data || { sessions: [], interventions: [] });
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value?.data || null);
    setLoading(false);
  }, [learnerId, stage]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const profileComplete = stage === 'junior'
    && !!profile
    && Array.isArray(profile.interestAreas) && profile.interestAreas.length > 0
    && Array.isArray(profile.strengthAreas) && profile.strengthAreas.length > 0
    && !!profile.learningPreference;
  const journeySteps = useMemo(() => stage === 'junior'
    ? [
      { label: 'Discover Me', done: profileComplete },
      { label: 'Recommendation', done: !!recommendation?.predictedPathway },
      { label: 'Careers', done: careers.length > 0 },
      { label: 'Senior schools', done: schools.length > 0 },
      { label: 'Decision plan', done: ['SUBMITTED', 'PARENT_REVIEWED', 'COUNSELLOR_REVIEWED', 'APPROVED', 'LOCKED'].includes(plan?.status) },
      { label: 'Ready', done: plan?.status === 'LOCKED' },
    ]
    : [
      { label: 'Evidence', done: !!recommendation?.predictedPathway },
      { label: 'Combination', done: !!selection },
      { label: 'Decision plan', done: ['SUBMITTED', 'PARENT_REVIEWED', 'COUNSELLOR_REVIEWED', 'APPROVED', 'LOCKED'].includes(plan?.status) },
      { label: 'Approved', done: ['APPROVED', 'LOCKED'].includes(plan?.status) },
      { label: 'Locked', done: plan?.status === 'LOCKED' },
    ], [stage, profileComplete, recommendation, selection, careers.length, schools.length, plan?.status]);
  const progress = useMemo(() => ({
    checks: journeySteps.map((step) => step.done),
    percent: Math.round((journeySteps.filter((step) => step.done).length / journeySteps.length) * 100),
  }), [journeySteps]);
  const nextStep = journeySteps.find((step) => !step.done);
  const updateAction = async (item, status) => {
    setUpdating(item.id);
    try { await pathwayPlannerAPI.updateOwnActionItem(learnerId, item.id, { status }); await load(); }
    finally { setUpdating(null); }
  };

  if (loading) return <div className="flex justify-center rounded-2xl border border-gray-200 bg-white p-6"><Loader2 className="animate-spin text-indigo-500" /></div>;
  const snapshot = plan?.submissions?.[0]?.snapshot || {};
  const participantRole = mode === 'parent' ? 'PARENT' : 'STUDENT';
  return <section className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-gray-900"><Sparkles size={15} className="text-indigo-600" /> {mode === 'parent' ? 'Pathway progress' : 'My pathway dashboard'}</p><p className="text-[10px] text-gray-500">{mode === 'parent' ? 'Current choices, reviews, support and actions for your child.' : 'Your live choices, reviews and next actions in one place.'}</p></div><div className="text-right"><p className="text-xl font-black text-indigo-700">{progress.percent}%</p><p className="text-[9px] font-bold text-gray-400">journey complete</p></div></div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress.percent}%` }} /></div>
    <div className={`grid gap-1 ${stage === 'junior' ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5'}`}>{journeySteps.map((step) => <div key={step.label} className={`rounded-lg border p-1.5 text-center text-[8px] font-black ${step.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>{step.done ? <CheckCircle2 size={10} className="mx-auto mb-0.5" /> : <Circle size={10} className="mx-auto mb-0.5" />}{step.label}</div>)}</div>
    {nextStep && <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-indigo-600">Next best step</p><p className="mt-0.5 text-xs font-bold text-indigo-900">{nextStep.label}</p></div>}
    {summaryOnly ? null : <>
    <div className="grid gap-2 md:grid-cols-3">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3"><p className="text-[9px] font-black uppercase text-indigo-600">Pathway & combination</p><p className="mt-1 text-xs font-black text-gray-900">{snapshot.selection?.pathway?.name || selection?.pathway?.name || recommendation?.predictedPathway || 'Not selected'}</p><p className="text-[10px] text-gray-600">{snapshot.selection?.combinationRule?.name || selection?.combinationRule?.name || 'Combination not selected'}</p></div>
      <div className="rounded-xl border border-rose-100 bg-rose-50 p-3"><p className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-600"><Heart size={9} /> Saved careers</p><div className="mt-1 space-y-0.5">{careers.length ? careers.slice(0, 4).map((item) => <p key={item.id} className="truncate text-[10px] font-bold text-gray-800">{item.career?.title}</p>) : <p className="text-[10px] text-gray-500">None saved</p>}</div></div>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600"><School size={9} /> Saved schools</p><div className="mt-1 space-y-0.5">{schools.length ? schools.slice(0, 4).map((item) => <p key={item.id} className="truncate text-[10px] font-bold text-gray-800">#{item.rank} {item.school?.name}</p>) : <p className="text-[10px] text-gray-500">None shortlisted</p>}</div></div>
    </div>
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-600"><ClipboardList size={11} /> Action plan</p>{!plan?.actionPlan?.items?.length ? <p className="mt-2 text-[10px] text-gray-500">No actions assigned yet. Your counsellor can add next steps after reviewing the plan.</p> : <div className="mt-2 space-y-2">{plan.actionPlan.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2"><div><p className={`text-[11px] font-bold ${item.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.title}</p><p className="text-[9px] text-gray-500">{item.assignedToRole} · {item.priority}{item.dueDate ? ` · due ${new Date(item.dueDate).toLocaleDateString()}` : ''}</p></div>{item.assignedToRole === participantRole && item.status !== 'COMPLETED' && <button type="button" disabled={updating === item.id} onClick={() => updateAction(item, item.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED')} className="flex-shrink-0 rounded-lg border border-indigo-200 px-2 py-1 text-[8px] font-black text-indigo-700">{updating === item.id ? 'Saving…' : item.status === 'PENDING' ? 'Start' : 'Complete'}</button>}</div>)}</div>}</div>
    <div className="grid gap-2 md:grid-cols-2"><div className="rounded-xl border border-sky-100 bg-sky-50 p-3"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-sky-700"><CalendarDays size={11} /> Shared counselling sessions</p>{participantProgress.sessions?.length ? <div className="mt-2 space-y-2">{participantProgress.sessions.map((session) => <div key={session.id} className="rounded-lg bg-white p-2"><div className="flex justify-between gap-2"><p className="text-[10px] font-bold text-gray-800">{session.purpose || session.reason || 'Pathway review'}</p><span className="text-[8px] font-black text-sky-700">{session.status}</span></div><p className="text-[9px] text-gray-500">{session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'Date being arranged'} · {session.mode}</p>{session.nextActions && <p className="mt-1 text-[9px] text-gray-600">Next: {session.nextActions}</p>}</div>)}</div> : <p className="mt-2 text-[10px] text-gray-500">No counselling sessions have been shared with you.</p>}</div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-700"><AlertTriangle size={11} /> Pathway support</p>{participantProgress.interventions?.length ? <div className="mt-2 space-y-2">{participantProgress.interventions.map((item) => <div key={item.id} className="rounded-lg bg-white p-2"><div className="flex justify-between gap-2"><p className="text-[10px] font-bold text-gray-800">{item.summary}</p><span className="text-[8px] font-black text-amber-700">{item.status}</span></div><p className="text-[9px] text-gray-500">{item.interventionType.replaceAll('_', ' ')} · {item.priority}{item.dueDate ? ` · due ${new Date(item.dueDate).toLocaleDateString()}` : ''}</p></div>)}</div> : <p className="mt-2 text-[10px] text-gray-500">No active pathway support interventions.</p>}</div></div>
    <PathwayConversation learnerId={learnerId} />
    </>}
  </section>;
}
