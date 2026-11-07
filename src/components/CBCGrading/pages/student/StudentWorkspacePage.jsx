import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, ArrowRight, BarChart3, BookOpen, CalendarDays,
  CheckCircle2, ClipboardList, Clock3, Loader2, RefreshCw,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';

const ACTIONS = [
  { label: 'Read my diary', detail: 'See class notes and homework', icon: BookOpen, color: 'bg-blue-600', page: 'student-diary' },
  { label: 'Submit my homework', detail: 'Finish work your teacher assigned', icon: ClipboardList, color: 'bg-violet-600', page: 'student-assignments' },
  { label: 'Continue learning', detail: 'Open my courses and lessons', icon: BookOpen, color: 'bg-emerald-600', page: 'student-courses' },
  { label: 'Check attendance', detail: 'View my attendance record', icon: CheckCircle2, color: 'bg-teal-700', page: 'student-attendance' },
  { label: 'View my timetable', detail: 'Check today’s lessons', icon: CalendarDays, color: 'bg-amber-600', page: 'student-timetable' },
  { label: 'See my progress', detail: 'Review results and learning progress', icon: BarChart3, color: 'bg-rose-600', page: 'student-progress' },
];

const isMissingLearner = (error) => {
  const message = String(error?.response?.data?.message || error?.message || '').toLowerCase();
  return error?.response?.status === 404 || error?.response?.status === 403
    || message.includes('learner record not found') || message.includes('unauthorized student');
};

export default function StudentWorkspacePage({ user, onNavigate }) {
  const [profileState, setProfileState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const name = user?.firstName || user?.first_name || user?.name?.trim()?.split(/\s+/)[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const emoji = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙';

  const checkProfile = useCallback(async () => {
    setProfileState('loading');
    setLoadError('');
    try {
      const response = await dashboardAPI.getStudentMetrics();
      if (response?.success === false && isMissingLearner({ message: response.message })) {
        setProfileState('unlinked');
      } else {
        setProfileState('ready');
      }
    } catch (error) {
      if (isMissingLearner(error)) setProfileState('unlinked');
      else {
        setProfileState('error');
        setLoadError('Could not check your learner profile. Try again when you are online.');
      }
    }
  }, []);

  useEffect(() => { checkProfile(); }, [checkProfile]);

  return <main className="min-h-[calc(100vh-80px)] bg-[#f6f8fc] px-3 py-4 pb-24 text-slate-950 sm:px-5 lg:px-7 lg:pb-6">
    <div className="mx-auto max-w-3xl space-y-4">
      {profileState === 'unlinked' && <aside className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950" role="status">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-800" />
        <p><strong>Student profile not linked.</strong> Ask your school office to connect this login to your learner record.</p>
      </aside>}
      {profileState === 'error' && <aside className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-950" role="alert">
        <AlertCircle size={17} /> <span className="flex-1">{loadError}</span>
        <button type="button" onClick={checkProfile} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white px-2.5 text-rose-900"><RefreshCw size={14} /> Retry</button>
      </aside>}

      <header className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-white"><BookOpen size={21} /></span>
          <div className="min-w-0"><h1 className="text-lg font-black tracking-tight text-slate-950">Student Workspace</h1><p className="text-xs text-slate-600">Your diary, learning and school day.</p></div>
          {profileState === 'loading' && <Loader2 size={16} className="ml-auto animate-spin text-indigo-800" aria-label="Checking learner profile" />}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-sm font-extrabold text-slate-950">{emoji} {greeting}, {name}</p>
          <p className="mt-0.5 text-xs text-slate-600">What would you like to do?</p>
        </div>
      </header>

      <nav aria-label="Student actions" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {ACTIONS.map(({ label, detail, icon: Icon, color, page }) => <button key={page} type="button" onClick={() => onNavigate?.(page)} className="flex min-h-[66px] w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-800">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${color}`}><Icon size={21} strokeWidth={2.2} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-950">{label}</span><span className="mt-0.5 block text-xs text-slate-600">{detail}</span></span>
          {page === 'student-timetable' ? <Clock3 size={17} className="shrink-0 text-slate-500" /> : <ArrowRight size={18} className="shrink-0 text-slate-500" />}
        </button>)}
      </nav>
      <p className="px-1 text-[11px] leading-relaxed text-slate-600">Your diary and school records are private to your learner account.</p>
    </div>
  </main>;
}
