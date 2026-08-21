import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Award, Bell, CheckCircle2, ChevronRight, CircleDashed,
  ClipboardList, FileCheck2, RefreshCw, RotateCcw, Send, Sparkles,
} from 'lucide-react';
import { lmsAPI } from '../../../../services/api';
import SubmissionModal from './SubmissionModal';

const GROUPS = [
  { id: 'todo', label: 'To do', icon: ClipboardList },
  { id: 'progress', label: 'In progress', icon: CircleDashed },
  { id: 'missing', label: 'Missing', icon: AlertCircle },
  { id: 'submitted', label: 'Submitted', icon: Send },
  { id: 'feedback', label: 'Feedback', icon: Award },
];
const TURNED_IN = new Set(['SUBMITTED', 'LATE', 'RESUBMITTED']);
const FEEDBACK = new Set(['MARKED', 'RETURNED']);

const assignmentGroup = (assignment) => {
  const status = assignment.statusSummary;
  if (status === 'IN_PROGRESS') return 'progress';
  if (status === 'MISSING') return 'missing';
  if (FEEDBACK.has(status)) return 'feedback';
  if (TURNED_IN.has(status)) return 'submitted';
  return 'todo';
};

const dueMeta = (assignment) => {
  if (!assignment.dueDate) return { label: 'No deadline', tone: 'text-slate-500 bg-slate-50' };
  const due = new Date(assignment.dueDate);
  const hours = Math.ceil((due.getTime() - Date.now()) / 3_600_000);
  if (assignment.isOverdue || hours < 0) return { label: 'Past due', tone: 'text-rose-700 bg-rose-50' };
  if (hours <= 24) return { label: hours <= 1 ? 'Due within an hour' : `Due in ${hours} hours`, tone: 'text-amber-800 bg-amber-50' };
  const days = Math.ceil(hours / 24);
  if (days <= 7) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'text-blue-700 bg-blue-50' };
  return { label: due.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }), tone: 'text-slate-600 bg-slate-50' };
};

const progressFor = (status) => {
  if (status === 'IN_PROGRESS') return 35;
  if (TURNED_IN.has(status)) return 70;
  if (status === 'RETURNED') return 78;
  if (status === 'MARKED') return 100;
  return 8;
};

const actionFor = (assignment) => {
  switch (assignment.statusSummary) {
    case 'IN_PROGRESS': return { label: 'Continue', icon: ChevronRight };
    case 'MISSING': return { label: assignment.canSubmit ? 'Submit late' : 'View details', icon: AlertCircle };
    case 'RETURNED': return { label: 'Revise work', icon: RotateCcw };
    case 'MARKED': return { label: 'View feedback', icon: Award };
    case 'SUBMITTED':
    case 'LATE':
    case 'RESUBMITTED': return { label: 'View submission', icon: FileCheck2 };
    default: return { label: 'Start', icon: ChevronRight };
  }
};

const escapeCalendarText = (value = '') => String(value).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const icsDate = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const addCalendarReminder = (assignment) => {
  if (!assignment.dueDate) return;
  const end = new Date(assignment.dueDate);
  const start = new Date(end.getTime() - 30 * 60 * 1000);
  const calendar = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TrendSCORE//Assignments//EN', 'BEGIN:VEVENT',
    `UID:${assignment.id}@trendscore`, `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeCalendarText(`Assignment due: ${assignment.title}`)}`,
    `DESCRIPTION:${escapeCalendarText(assignment.instructions || 'Complete and submit this assignment in TrendSCORE.')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Assignment due tomorrow',
    'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${assignment.title || 'assignment'}.ics`.replace(/[^a-z0-9._-]+/gi, '-');
  anchor.click();
  URL.revokeObjectURL(url);
};

function AssignmentCard({ assignment, onOpen }) {
  const due = dueMeta(assignment);
  const action = actionFor(assignment);
  const ActionIcon = action.icon;
  const progress = progressFor(assignment.statusSummary);

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md motion-reduce:hover:translate-y-0">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${due.tone}`}>{due.label}</span>
              {assignment.estimatedMins ? <span className="text-[11px] font-semibold text-slate-400">About {assignment.estimatedMins} min</span> : null}
            </div>
            <h2 className="mt-3 text-base font-black text-[#06285a]">{assignment.title}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.learningArea?.name || 'Learning area'} · {assignment.class?.name || 'Class'}</p>
          </div>
          {assignment.statusSummary === 'MARKED' && (
            <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-center text-emerald-700">
              <p className="text-base font-black">{assignment.mySubmission?.marks ?? '—'}/{assignment.totalMarks ?? '—'}</p>
              <p className="text-[9px] font-bold uppercase">Marked</p>
            </div>
          )}
        </div>
        {assignment.instructions && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{assignment.instructions}</p>}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span>{assignment.statusSummary?.replace(/_/g, ' ').toLowerCase()}</span><span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {assignment.statusSummary === 'RETURNED' && assignment.mySubmission?.feedback && (
          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-relaxed text-violet-800">
            <span className="font-black">Teacher feedback:</span> {assignment.mySubmission.feedback}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onOpen(assignment)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#030b82] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#06285a] active:scale-[0.98] motion-reduce:transition-none sm:flex-none">
            <ActionIcon size={14} /> {action.label}
          </button>
          {assignment.dueDate && assignmentGroup(assignment) !== 'feedback' && (
            <button type="button" onClick={() => addCalendarReminder(assignment)} title="Download a calendar reminder"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800">
              <Bell size={13} /> Remind me
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const MyAssignments = ({ onNavigate }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState('todo');
  const [submitting, setSubmitting] = useState(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await lmsAPI.getStudentAssignments();
      setAssignments(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err?.message || 'Could not load assignments. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const grouped = useMemo(() => GROUPS.reduce((result, item) => ({
    ...result,
    [item.id]: assignments.filter((assignment) => assignmentGroup(assignment) === item.id),
  }), {}), [assignments]);
  const visible = grouped[group] || [];
  const completedCount = grouped.feedback?.filter((assignment) => assignment.statusSummary === 'MARKED').length || 0;
  const completion = assignments.length ? Math.round((completedCount / assignments.length) * 100) : 0;

  const openAssignment = (assignment) => {
    const structured = Array.isArray(assignment.questions) && assignment.questions.length > 0;
    const viewOnly = ['MARKED', 'SUBMITTED', 'LATE', 'RESUBMITTED'].includes(assignment.statusSummary);
    if (structured || viewOnly || ['IN_PROGRESS', 'RETURNED'].includes(assignment.statusSummary) || !assignment.canSubmit) {
      onNavigate?.('learning-assignment-detail', { assignmentId: assignment.id });
      return;
    }
    setSubmitting(assignment);
  };

  return (
    <div className="space-y-5 pb-20">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#06285a] to-[#030b82] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2"><ClipboardList size={21} /><h1 className="text-xl font-black">My Assignments</h1></div><p className="mt-1 text-sm text-white/70">Plan your work, continue drafts and act on feedback.</p></div>
          <button type="button" onClick={fetchAssignments} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{grouped.todo?.length || 0}</p><p className="text-[10px] font-bold uppercase text-white/60">To do</p></div>
          <div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{grouped.missing?.length || 0}</p><p className="text-[10px] font-bold uppercase text-white/60">Missing</p></div>
          <div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{completion}%</p><p className="text-[10px] font-bold uppercase text-white/60">Marked</p></div>
        </div>
      </header>
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><Bell size={15} className="mt-0.5 shrink-0" /><p><span className="font-black">Automatic reminder:</span> TrendSCORE alerts you the day before unfinished work is due. Use “Remind me” to add it to your personal calendar too.</p></div>
      {error && <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={18} />{error}</div>}
      <nav aria-label="Assignment groups" className="flex gap-2 overflow-x-auto pb-1">
        {GROUPS.map((item) => { const Icon = item.icon; const active = item.id === group; return (
          <button key={item.id} type="button" onClick={() => setGroup(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${active ? 'border-[#030b82] bg-[#030b82] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'}`}>
            <Icon size={13} /> {item.label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{grouped[item.id]?.length || 0}</span>
          </button>); })}
      </nav>
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-60 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : visible.length ? (
        <div className="grid gap-4 lg:grid-cols-2">{visible.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} onOpen={openAssignment} />)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          {group === 'todo' && assignments.length === 0 ? <Sparkles size={36} className="mx-auto mb-3 text-emerald-400" /> : <CheckCircle2 size={36} className="mx-auto mb-3 text-slate-300" />}
          <p className="font-black text-[#06285a]">{assignments.length === 0 ? 'No assignments have been issued yet' : `Nothing in ${GROUPS.find((item) => item.id === group)?.label.toLowerCase()}`}</p>
          <p className="mt-1 text-sm text-slate-500">{assignments.length === 0 ? 'New published assignments will appear here automatically.' : 'You are clear in this group.'}</p>
        </div>
      )}
      {submitting && <SubmissionModal assignment={submitting} onClose={() => setSubmitting(null)} onSubmitted={() => { setSubmitting(null); fetchAssignments(); }} />}
    </div>
  );
};

export default MyAssignments;
