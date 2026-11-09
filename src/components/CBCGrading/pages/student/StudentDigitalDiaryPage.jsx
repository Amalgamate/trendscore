import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, BookOpen, CalendarDays,
  CheckCircle2, ChevronRight, ClipboardList, FileText, Loader2, RefreshCw, X,
} from 'lucide-react';
import { lmsAPI } from '../../../../services/api';

const localDateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDiaryDate = (date) => new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
const sameLocalDay = (left, right) => left && right && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

const homeworkKind = (assignment) => {
  const type = [assignment.workType, assignment.assignmentType, assignment.type, assignment.category].filter(Boolean).join(' ').toLowerCase();
  return type.includes('holiday') ? 'Holiday homework' : 'Daily homework';
};

const STATUS = {
  MARKED: { label: 'Feedback ready', style: 'bg-emerald-100 text-emerald-900', icon: CheckCircle2 },
  SUBMITTED: { label: 'Submitted', style: 'bg-blue-100 text-blue-900', icon: CheckCircle2 },
  RESUBMITTED: { label: 'Resubmitted', style: 'bg-blue-100 text-blue-900', icon: CheckCircle2 },
  LATE: { label: 'Late', style: 'bg-amber-100 text-amber-950', icon: AlertCircle },
  RETURNED: { label: 'Needs revision', style: 'bg-violet-100 text-violet-900', icon: RefreshCw },
  IN_PROGRESS: { label: 'In progress', style: 'bg-amber-100 text-amber-950', icon: ClipboardList },
  MISSING: { label: 'Overdue', style: 'bg-rose-100 text-rose-900', icon: AlertCircle },
};

function AssignmentRow({ assignment, onOpen }) {
  const paperState = String(assignment.offlineCompletion?.status || assignment.offlineCompletionStatus || assignment.completionStatus || '').toUpperCase();
  const doneOnPaper = ['DONE', 'DONE_ON_PAPER', 'COMPLETED_OFFLINE'].includes(paperState);
  const status = doneOnPaper
    ? { label: 'Done on paper', style: 'bg-emerald-100 text-emerald-900', icon: CheckCircle2 }
    : STATUS[assignment.statusSummary] || { label: 'To do', style: 'bg-slate-100 text-slate-800', icon: ClipboardList };
  const StatusIcon = status.icon;
  const actionLabel = assignment.statusSummary === 'RETURNED'
    ? 'View revision details'
    : assignment.statusSummary === 'MARKED'
      ? 'View feedback'
      : ['SUBMITTED', 'LATE', 'RESUBMITTED'].includes(assignment.statusSummary)
        ? 'View submission'
        : 'Open assignment';
  const feedback = assignment.mySubmission?.feedback;
  const marks = assignment.mySubmission?.marks;
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : 'No due date';
  return <article className="flex items-start gap-3 p-3 sm:p-4">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${homeworkKind(assignment) === 'Holiday homework' ? 'bg-violet-700' : 'bg-blue-700'}`}><BookOpen size={18} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5"><h3 className="text-sm font-extrabold text-slate-950">{assignment.title}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{homeworkKind(assignment)}</span></div>
      <p className="mt-0.5 text-xs text-slate-700">{[assignment.learningArea?.name || 'Class work', assignment.class?.name, `Due ${dueDate}`].filter(Boolean).join(' · ')}</p>
      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${status.style}`}><StatusIcon size={12} />{status.label}</span>
      {marks != null && <p className="mt-2 text-xs font-bold text-emerald-900">Feedback: {marks}/{assignment.totalMarks ?? '—'} marks</p>}
      {feedback && <p className="mt-1 text-xs leading-relaxed text-slate-700">{feedback}</p>}
      <button type="button" onClick={() => onOpen(assignment)} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg bg-indigo-800 px-3 text-xs font-bold text-white hover:bg-indigo-900">{actionLabel}<ChevronRight size={14} /></button>
    </div>
  </article>;
}

export default function StudentDigitalDiaryPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState('today');
  const [workType, setWorkType] = useState('all');
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await lmsAPI.getStudentAssignments();
      setAssignments(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err?.message || 'Your diary could not load. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    if (workType !== 'all' && homeworkKind(assignment) !== workType) return false;
    if (view === 'all') return true;
    if (!assignment.dueDate) return false;
    return sameLocalDay(new Date(assignment.dueDate), selectedDate);
  }).sort((a, b) => new Date(a.dueDate || 8640000000000000) - new Date(b.dueDate || 8640000000000000)), [assignments, selectedDate, view, workType]);

  const changeDate = (delta) => setSelectedDate(current => new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta));
  const openAssignment = (assignment) => setSelectedAssignment(assignment);

  return <main className="min-h-screen bg-[#f6f8fc] px-3 py-4 pb-24 text-slate-900 sm:px-5 lg:px-7 lg:pb-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-800 text-white"><BookOpen size={20} /></span><div><p className="text-xs font-bold text-indigo-800">My learning day</p><h1 className="text-xl font-black tracking-tight text-slate-950">My Diary</h1></div></div>
        <button type="button" onClick={loadAssignments} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>

      {!online && <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-950"><AlertCircle size={16} />You’re offline. Diary updates may be out of date until you reconnect.</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white"><CalendarDays size={18} /></span><div><h2 className="text-sm font-extrabold text-slate-950">{view === 'today' ? formatDiaryDate(selectedDate) : 'All my work'}</h2><p className="text-xs text-slate-600">Your teacher’s shared notes and work for you.</p></div></div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
            <button type="button" onClick={() => { setView('today'); changeDate(-1); }} aria-label="Previous day" disabled={view === 'all'} className="rounded-md p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ArrowLeft size={15} /></button>
            <button type="button" onClick={() => { setView('today'); setSelectedDate(new Date()); }} className="min-h-8 px-2 text-[11px] font-bold text-indigo-900">Today</button>
            <button type="button" onClick={() => { setView('today'); changeDate(1); }} aria-label="Next day" disabled={view === 'all'} className="rounded-md p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ArrowRight size={15} /></button>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <div className="flex items-center gap-2"><FileText size={16} className="text-blue-800" /><h3 className="text-xs font-extrabold text-slate-950">Class diary note</h3></div>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">When your teacher shares a class note, you’ll find it here.</p>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-extrabold text-slate-950">Homework</h2><p className="text-xs text-slate-600">See what’s due and check feedback from your teacher.</p></div><div className="flex gap-1.5">
          {[{ value: 'all', label: 'Daily + holiday' }, { value: 'Daily homework', label: 'Daily' }, { value: 'Holiday homework', label: 'Holiday' }].map(item => <button key={item.value} type="button" onClick={() => setWorkType(item.value)} aria-pressed={workType === item.value} className={`min-h-9 rounded-lg border px-2.5 text-[11px] font-bold ${workType === item.value ? 'border-indigo-800 bg-indigo-800 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>{item.label}</button>)}
        </div></div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-700"><Loader2 size={18} className="animate-spin text-indigo-800" />Loading your diary…</div>
            : error ? <div className="p-5 text-center"><p className="text-sm font-semibold text-rose-800">{error}</p><button type="button" onClick={loadAssignments} className="mt-2 text-xs font-bold text-indigo-800 underline">Try again</button></div>
              : visibleAssignments.length ? <div className="divide-y divide-slate-100">{visibleAssignments.map(item => <AssignmentRow key={item.id} assignment={item} onOpen={openAssignment} />)}</div>
                : <div className="p-7 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-900"><CheckCircle2 size={20} /></span><p className="mt-2 text-sm font-extrabold text-slate-950">{view === 'today' ? 'No homework due on this day' : 'No homework has been issued yet'}</p><p className="mt-1 text-xs text-slate-600">New work will appear here when your teacher shares it.</p></div>}
        </div>
        {!loading && !error && assignments.length > 0 && <button type="button" onClick={() => { setView(view === 'all' ? 'today' : 'all'); setWorkType('all'); }} className="inline-flex min-h-10 items-center gap-1 px-1 text-xs font-bold text-indigo-800 hover:underline">{view === 'all' ? 'Back to selected day' : `View all ${assignments.length} assignments`}<ChevronRight size={14} /></button>}
      </section>
      <p className="text-[11px] text-slate-600">You’ll only see your own work and any notes shared with your class.</p>
    </div>
    {selectedAssignment && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Assignment preview" onMouseDown={() => setSelectedAssignment(null)}>
      <section className="max-h-[86dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-indigo-800">{homeworkKind(selectedAssignment)} · {selectedAssignment.learningArea?.name || 'Class work'}</p><h2 className="mt-1 text-lg font-black text-slate-950">{selectedAssignment.title}</h2></div><button type="button" onClick={() => setSelectedAssignment(null)} aria-label="Close assignment preview" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18} /></button></header>
        <p className="mt-2 text-xs text-slate-700">Due {selectedAssignment.dueDate ? new Date(selectedAssignment.dueDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'No due date'}</p>
        {selectedAssignment.instructions && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{selectedAssignment.instructions}</p>}
        {selectedAssignment.mySubmission?.feedback && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-extrabold text-emerald-950">Teacher feedback</p><p className="mt-1 text-sm text-emerald-950">{selectedAssignment.mySubmission.feedback}</p></div>}
      </section>
    </div>}
  </main>;
}
