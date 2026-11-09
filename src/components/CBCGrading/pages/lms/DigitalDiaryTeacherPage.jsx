import React, { useEffect, useState } from 'react';
import api, { dashboardAPI, attendanceAPI, assessmentAPI } from '../../../../services/api';
import ClockInStatusWidget from '../../dashboard/widgets/teacher/ClockInStatusWidget';
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookOpen, Calendar,
  CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Eye, FileText, Loader2, MessageSquare,
  Plus, Users, AlertCircle, X,
} from 'lucide-react';

const CLASSES = [
  { id: 'g7a', name: 'Grade 7 A', count: 28, subject: 'Mathematics' },
  { id: 'g7b', name: 'Grade 7 B', count: 26, subject: 'Mathematics' },
  { id: 'g6a', name: 'Grade 6 A', count: 31, subject: 'Science' },
];

const LEARNERS = [
  { initials: 'AM', name: 'Amina Mwangi', admission: 'ADM-2025-0341', state: 'Submitted', tone: 'blue' },
  { initials: 'BK', name: 'Brian Kiptoo', admission: 'ADM-2025-0178', state: 'Done · paper', tone: 'green' },
  { initials: 'CN', name: 'Cynthia Njeri', admission: 'ADM-2025-0294', state: 'Not submitted', tone: 'amber' },
  { initials: 'DM', name: 'David Mutua', admission: 'ADM-2025-0412', state: 'Excused', tone: 'violet' },
];

function formatDate(date) {
  return new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function Surface({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,.035)] ${className}`}>{children}</section>;
}

function SmallLabel({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{children}</p>;
}

export default function DigitalDiaryTeacherPage({ user, onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [classId, setClassId] = useState('g7a');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('today');
  const [mobileHomeOpen, setMobileHomeOpen] = useState(true);
  const [entryPage, setEntryPage] = useState(null);
  const [toast, setToast] = useState('');
  const teacherStats = dashboard?.stats || {};
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const greetingEmoji = currentHour < 12 ? '☀️' : currentHour < 17 ? '🌤️' : '🌙';
  const teacherFirstName = user?.firstName || user?.first_name || user?.name?.split(' ')?.[0] || 'Teacher';
  const attendanceDue = dashboard?.attendanceDue || [];
  const assessmentsToMark = dashboard?.assessmentsToMark || [];
  const schedule = dashboard?.schedule || [];
  const assignedClasses = dashboard?.myClasses || [];
  const classOptions = assignedClasses.length
    ? assignedClasses.map((item, index) => ({ id: String(item.id || `assigned-${index}`), name: item.name || 'Assigned class', count: Number(item.learnerCount || 0), subject: item.subjects?.[0] || 'Class' }))
    : CLASSES;
  const selectedClass = classOptions.find((item) => item.id === classId) || classOptions[0];

  useEffect(() => {
    let active = true;
    dashboardAPI.getTeacherMetrics('today')
      .then((response) => {
        if (!active) return;
        if (response?.success) setDashboard(response.data || {});
        else setDashboardError(response?.message || 'Daily teacher overview is unavailable.');
      })
      .catch((error) => {
        if (active) setDashboardError(error?.message || 'Could not load your daily teacher overview.');
      })
      .finally(() => { if (active) setDashboardLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.userId]);

  const nextAction = dashboard?.nextAction;

  const shiftDate = (amount) => setSelectedDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount));

  const showToast = (message, tone = 'info') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(''), 4000);
  };

  const handlePublished = (noticeTitle) => {
    showToast(`"${noticeTitle}" published to parents successfully.`, 'success');
    setEntryPage(null);
  };

  const handlePublishError = (message) => {
    showToast(message || 'Could not publish. Please try again.', 'error');
  };

  const previewNotice = () => {
    showToast('Preview only — nothing has been saved or sent.', 'info');
  };

  const tabs = [
    { id: 'today', label: 'My Day Today', icon: CalendarDays, color: 'bg-[#2563eb]', tint: 'bg-blue-50', border: 'border-blue-500' },
    { id: 'plan', label: 'Class Plan', icon: Calendar, color: 'bg-[#16a34a]', tint: 'bg-emerald-50', border: 'border-emerald-500' },
    { id: 'entries', label: 'Diary Entries', icon: MessageSquare, color: 'bg-[#9333ea]', tint: 'bg-purple-50', border: 'border-purple-500' },
    { id: 'assessment', label: 'Record Scores', icon: Activity, color: 'bg-[#dc2626]', tint: 'bg-red-50', border: 'border-red-500' },
    { id: 'attendance', label: 'Take Attendance', icon: Check, color: 'bg-[#0f766e]', tint: 'bg-teal-50', border: 'border-teal-600' },
  ];

  return (
    <main data-active-workspace-page={activeTab} className="min-h-[calc(100vh-80px)] bg-[#f6f8fc] px-3 pt-3 pb-24 text-slate-900 sm:px-5 lg:px-7 lg:pb-3">
      <div className="mx-auto max-w-[1380px] space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172554] text-white"><BookOpen size={18} /></div><div><div className="flex items-center gap-2"><h1 className="text-xl font-black tracking-tight text-slate-950">Teacher Workspace</h1></div></div></div>
          <div className={`flex flex-wrap items-center gap-2 ${mobileHomeOpen ? 'hidden md:flex' : ''}`}>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"><Users size={15} className="text-indigo-600" /><select aria-label="Select class" value={selectedClass.id} onChange={(event) => setClassId(event.target.value)} className="max-w-[150px] bg-transparent text-xs font-bold text-slate-800 outline-none">{classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} className="text-slate-400" /></label>
            {!assignedClasses.length && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-950">Sample classes</span>}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => shiftDate(-1)} aria-label="Previous day" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowLeft size={14} /></button><button onClick={() => setSelectedDate(new Date())} className="px-2 text-[11px] font-bold text-slate-700">{new Intl.DateTimeFormat('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }).format(selectedDate)}</button><button onClick={() => shiftDate(1)} aria-label="Next day" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowRight size={14} /></button></div>
          </div>
        </header>

        <section aria-label="Teacher greeting and clock in" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4">
          <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950">{greetingEmoji} {greeting}, {teacherFirstName}</p><p className="mt-0.5 text-xs text-slate-600">Ready for today’s classes?</p></div>
          <ClockInStatusWidget user={user} variant="compact" />
        </section>

        <nav className="hidden overflow-x-auto px-1 py-1 scrollbar-none lg:block" role="tablist" aria-label="Teacher workspace sections"><div className="flex min-w-max items-center gap-2.5">{tabs.map(({ id, label, icon: Icon, color }) => <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => { setActiveTab(id); setMobileHomeOpen(false); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 sm:px-5 sm:text-sm ${color} ${activeTab === id ? 'ring-2 ring-slate-900 ring-offset-2' : 'opacity-90 hover:opacity-100'}`}><Icon size={16} />{label}</button>)}</div></nav>

        {mobileHomeOpen && <MobileWorkspaceMenu
          onSelect={(id) => { setActiveTab(id); setEntryPage(null); setMobileHomeOpen(false); }}
          onCompose={(kind) => { setActiveTab('entries'); setEntryPage(kind); setMobileHomeOpen(false); }}
          onNavigate={onNavigate}
        />}

        {!mobileHomeOpen && <div className="mb-2 lg:hidden"><button type="button" onClick={() => { setActiveTab('today'); setEntryPage(null); setMobileHomeOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-indigo-800 hover:bg-white"><ArrowLeft size={16} /> Teacher Workspace</button></div>}

        {activeTab === 'today' && <div className={`${mobileHomeOpen ? 'hidden lg:block' : ''} space-y-3`}>
          <div className="grid gap-1 rounded-xl border border-slate-200 bg-white px-3 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">{[{ icon: Users, label: 'My learners', value: dashboardLoading ? '…' : dashboardError ? '—' : (teacherStats.myStudents ?? 0), page: 'teacher-learner-analysis' }, { icon: Check, label: 'Registers to complete', value: dashboardLoading ? '…' : dashboardError ? '—' : attendanceDue.length, tab: 'attendance' }, { icon: ClipboardList, label: 'Scores to review', value: dashboardLoading ? '…' : dashboardError ? '—' : assessmentsToMark.length, tab: 'assessment' }].map(({ icon: Icon, label, value, tab, page }) => <button key={label} onClick={() => page ? onNavigate?.(page) : (setActiveTab(tab), setMobileHomeOpen(false))} className="flex min-h-14 items-center gap-2.5 px-2 text-left hover:bg-slate-50 sm:px-3"><Icon size={16} className="shrink-0 text-indigo-700" /><span className="min-w-0 flex-1 text-xs font-semibold text-slate-700">{label}</span><span className="text-sm font-extrabold text-slate-950">{value}</span><ChevronRight size={14} className="text-slate-500" /></button>)}</div>
          {dashboardError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Daily overview unavailable. Refresh to try again.</p>}
          <Surface className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><SmallLabel>UP NEXT</SmallLabel><h2 className="mt-0.5 text-sm font-extrabold">Your day</h2></div><span className="text-[11px] font-semibold text-slate-600">{formatDate(selectedDate)}</span></div><div className="grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-slate-100"><div className="p-4">{dashboardLoading ? <p className="text-xs text-slate-700">Loading daily tasks…</p> : nextAction ? <button onClick={() => nextAction.navigateTo === 'attendance-daily' ? setActiveTab('attendance') : nextAction.navigateTo === 'assess-summative-assessment' ? setActiveTab('assessment') : setActiveTab('plan')} className="flex w-full items-start gap-3 rounded-xl bg-indigo-50 p-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2939a7] text-white"><Bell size={15} /></span><span><strong className="block text-xs text-slate-950">{nextAction.title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-slate-700">{nextAction.description}</span><span className="mt-1.5 block text-[11px] font-bold text-indigo-900">{nextAction.actionLabel}</span></span></button> : <p className="text-xs text-slate-700">No urgent tasks are waiting.</p>}</div><div className="p-4"><div className="flex items-center justify-between"><SmallLabel>TODAY’S CLASSES</SmallLabel><button onClick={() => setActiveTab('plan')} className="text-[11px] font-bold text-indigo-800">Class plan <ChevronRight size={12} className="inline" /></button></div>{schedule.length ? <div className="mt-1 divide-y divide-slate-100">{schedule.slice(0, 3).map((item, index) => <div key={`${item.id || item.subject}-${index}`} className="flex items-center justify-between gap-2 py-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{item.subject || item.learningArea || 'Lesson'}</p><p className="truncate text-[10px] text-slate-600">{item.className || item.class?.name || item.class?.stream || 'Assigned class'}</p></div><span className="shrink-0 text-[10px] font-semibold text-slate-700">{item.time || item.startTime || ''}</span></div>)}</div> : <p className="mt-2 text-xs text-slate-700">{dashboardLoading ? 'Loading schedule…' : 'No lessons scheduled today.'}</p>}</div></div></Surface>
        </div>}

        {activeTab === 'plan' && <ClassPlanWorkspace selectedClass={selectedClass} schedule={schedule} dashboardLoading={dashboardLoading} onNavigate={onNavigate} />}
        {activeTab === 'entries' && (entryPage
          ? <DiaryEntryComposerPage kind={entryPage} selectedClass={selectedClass} selectedDate={selectedDate} onBack={() => setEntryPage(null)} onPublished={handlePublished} onError={handlePublishError} />
          : <DiaryEntriesWorkspace selectedClass={selectedClass} onCompose={setEntryPage} />)}
        {activeTab === 'assessment' && <AssessmentWorkspace selectedClass={selectedClass} />}
        {activeTab === 'attendance' && <AttendanceWorkspace selectedClass={selectedClass} />}
      </div>
      {toast && (() => {
        const tone = typeof toast === 'string' ? 'info' : toast.tone;
        const msg = typeof toast === 'string' ? toast : toast.message;
        const cls = tone === 'success' ? 'bg-emerald-600' : tone === 'error' ? 'bg-rose-600' : 'bg-slate-900';
        return <div role="status" className={`fixed bottom-5 left-1/2 z-[110] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${cls}`}>{msg}</div>;
      })()}
    </main>
  );
}

function MobileWorkspaceMenu({ onSelect, onCompose, onNavigate }) {
  const tasks = [
    { label: 'Check my day', icon: CalendarDays, color: 'bg-[#2563eb]', tab: 'today' },
    { label: 'Plan my classes', icon: Calendar, color: 'bg-[#16a34a]', tab: 'plan' },
    { label: 'Write a class message', icon: MessageSquare, color: 'bg-[#149447]', compose: 'note' },
    { label: 'Set daily homework', icon: BookOpen, color: 'bg-[#2563eb]', compose: 'daily' },
    { label: 'Set holiday homework', icon: CalendarDays, color: 'bg-[#7c3aed]', compose: 'holiday' },
    { label: 'Record scores', icon: Activity, color: 'bg-[#dc2626]', tab: 'assessment' },
    { label: 'Take attendance', icon: Check, color: 'bg-[#0f766e]', tab: 'attendance' },
    { label: 'Review my learners', icon: Users, color: 'bg-[#334155]', page: 'teacher-learner-analysis' },
  ];
  return <section className="space-y-3 py-1 lg:hidden" aria-label="Teacher workspace pages">
    <h2 className="px-1 text-base font-extrabold text-slate-950">What would you like to do?</h2>
    <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{tasks.map(({ label, icon: Icon, color, tab, compose, page }) => <button key={label} type="button" onClick={() => page ? onNavigate?.(page) : compose ? onCompose(compose) : onSelect(tab)} className="flex min-h-14 w-full items-center gap-3 px-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${color}`}><Icon size={21} strokeWidth={2.2} /></span><span className="min-w-0 flex-1 text-sm font-bold text-slate-900">{label}</span><ChevronRight size={19} className="shrink-0 text-slate-600" /></button>)}</div>
  </section>;
}

function DiaryEntriesWorkspace({ selectedClass, onCompose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const actions = [
    { kind: 'note', title: 'Write a class message', detail: 'Share an update or reminder', icon: MessageSquare, color: 'text-emerald-700 bg-emerald-50' },
    { kind: 'daily', title: 'Set daily homework', detail: 'Give learners work for today', icon: BookOpen, color: 'text-blue-700 bg-blue-50' },
    { kind: 'holiday', title: 'Set holiday homework', detail: 'Prepare work for the break', icon: Calendar, color: 'text-violet-700 bg-violet-50' },
  ];

  const fetchEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.notices.getAll();
      if (resp?.success === false) throw new Error(resp.error || resp.message || 'Failed to load entries');
      const list = (resp?.data || [])
        .filter((n) => {
          const audience = String(n.targetAudience || '').toUpperCase();
          return !audience || audience.includes('PARENTS') || audience.includes('STUDENTS');
        })
        .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
      setEntries(list);
    } catch (err) {
      console.error('Failed to fetch diary entries:', err);
      setError(err?.message || 'Could not load diary entries.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedClass.id]);

  const formatEntryDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Shared today';
    return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(date);
  };

  const getEntryMeta = (entry) => {
    const category = entry.category || 'General';
    if (category.toLowerCase() === 'homework') {
      const area = entry.title?.split(':')[0] || entry.learningArea || 'Homework';
      const due = entry.expiresAt
        ? `Due ${new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(new Date(entry.expiresAt))}`
        : '';
      return { type: 'Homework', area, due, accent: 'violet' };
    }
    return { type: 'Class message', area: '', due: '', accent: 'emerald' };
  };

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><SmallLabel>{selectedClass.name}</SmallLabel><h2 className="mt-0.5 text-lg font-black tracking-tight">Diary Entries</h2></div></div>
    <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{actions.map(({ kind, title, detail, icon: Icon, color }) => <button key={kind} onClick={() => onCompose(kind)} className="flex min-h-14 w-full items-center gap-3 px-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-slate-900">{title}</strong><span className="block text-xs text-slate-600">{detail}</span></span><ChevronRight size={17} className="text-slate-600" /></button>)}</div>
    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-extrabold text-slate-950">Recent entries</h3>{loading && <Loader2 size={14} className="animate-spin text-slate-400" />}</div>
      {error && <div className="flex items-start gap-2 border-b border-slate-100 bg-amber-50 px-4 py-3 text-xs text-amber-900"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</div>}
      {!loading && entries.length === 0 && <div className="px-4 py-6 text-center"><p className="text-xs text-slate-500">No diary entries yet.</p><p className="mt-1 text-[11px] text-slate-400">Use the buttons above to share a message or set homework.</p></div>}
      <div className="divide-y divide-slate-100">
        {entries.map((entry) => {
          const meta = getEntryMeta(entry);
          const accent = meta.accent === 'violet' ? 'bg-violet-50 text-violet-800' : 'bg-emerald-50 text-emerald-800';
          const Icon = meta.accent === 'violet' ? BookOpen : MessageSquare;
          const dateLabel = formatEntryDate(entry.publishedAt || entry.createdAt);
          return <div key={entry.id} className="flex w-full items-start gap-3 px-4 py-3 text-left">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}><Icon size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-xs text-slate-900">{entry.title}</strong>
                {dateLabel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700">{dateLabel}</span>}
                {meta.type && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">{meta.type}</span>}
              </span>
              <span className="mt-1 block truncate text-xs leading-relaxed text-slate-600">{entry.content}</span>
              {(meta.area || meta.due) && <span className="mt-1 block text-[11px] text-slate-500">{meta.area}{meta.area && meta.due ? ' · ' : ''}{meta.due}</span>}
            </span>
          </div>;
        })}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">Visible to learners and families based on the selected audience.</div>
    </Surface>
  </div>;
}

function DiaryEntryComposerPage({ kind, selectedClass, selectedDate, onBack, onPublished, onError }) {
  const isMessage = kind === 'note';
  const isHoliday = kind === 'holiday';

  // ── Form state ──
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [learningArea, setLearningArea] = useState(selectedClass.subject || 'Mathematics');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [completionMode, setCompletionMode] = useState('online');
  const [submitting, setSubmitting] = useState(false);

  const headingText = isMessage ? 'Write a class message' : isHoliday ? 'Set holiday homework' : 'Set daily homework';
  const publishLabel = isMessage ? 'Publish message' : 'Publish homework';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !content.trim()) return;

    // Build the notice payload. targetAudience: 'PARENTS' so it appears in
    // parent diary feeds (server filters by role tokens — see
    // notice.controller.ts isNoticeVisibleTo).
    const payload = {
      title: subject.trim(),
      content: content.trim(),
      category: isMessage ? 'General' : 'Homework',
      priority,
      status: 'PUBLISHED',
      targetAudience: 'PARENTS',
    };

    setSubmitting(true);
    try {
      const res = await api.notices.create(payload);
      if (res?.success === false) {
        throw new Error(res?.error || res?.message || 'Server rejected the notice');
      }
      onPublished?.(subject.trim());
    } catch (err) {
      const msg = err?.message?.includes('403')
        ? 'You don\u2019t have permission to publish diary entries. Contact your school admin.'
        : err?.message?.includes('429')
        ? 'Too many entries published recently. Please wait a minute and try again.'
        : err?.message || 'Could not publish. Please try again.';
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="space-y-3">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-indigo-800 hover:bg-white"><ArrowLeft size={16} /> Diary entries</button>
    <div className="flex flex-wrap items-end justify-between gap-2"><div><SmallLabel>{selectedClass.name} · {formatDate(selectedDate)}</SmallLabel><h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{headingText}</h2></div></div>
    <form onSubmit={handleSubmit} className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
      <Surface className="space-y-3 p-3.5 sm:p-4">
        {!isMessage && <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-600">Learning area<select value={learningArea} onChange={(e) => setLearningArea(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500"><option>{selectedClass.subject || 'General'}</option><option>English</option><option>Science</option><option>Mathematics</option><option>Social Studies</option><option>Kiswahili</option><option>Religious Education</option><option>Creative Arts</option><option>Pre-Technical Studies</option></select></label><label className="block text-xs font-bold text-slate-600">Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-[11px] text-sm text-slate-800 outline-none focus:border-indigo-500" /></label></div>}
        <label className="block text-xs font-bold text-slate-600">{isMessage ? 'Message subject' : 'Assignment title'}<input required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder={isMessage ? 'e.g. Reminder for tomorrow' : 'e.g. Fractions practice'} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500" /></label>
        <label className="block text-xs font-bold text-slate-600">{isMessage ? 'Message' : 'Instructions for learners'}<textarea required rows={7} value={content} onChange={(e) => setContent(e.target.value)} maxLength={10000} placeholder={isMessage ? 'Write the update or reminder for your class…' : 'Explain the work, how to complete it, and what to submit…'} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500" /></label>
        {!isMessage && <fieldset><legend className="text-xs font-bold text-slate-600">How will learners complete the work?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" aria-pressed={completionMode === 'online'} onClick={() => setCompletionMode('online')} className={`rounded-xl border p-3 text-left ${completionMode === 'online' ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white'}`}><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText size={16} className="text-indigo-600" /> Online submission</span><span className="mt-1 block text-xs text-slate-500">Learners submit work in TrendSCORE</span></button><button type="button" aria-pressed={completionMode === 'paper'} onClick={() => setCompletionMode('paper')} className={`rounded-xl border p-3 text-left ${completionMode === 'paper' ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-200 bg-white'}`}><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><CheckCircle2 size={16} className="text-emerald-600" /> Paper / offline</span><span className="mt-1 block text-xs text-slate-500">Record class completion later</span></button></div></fieldset>}
        <div><p className="text-xs font-bold text-slate-600 mb-2">Priority</p><div className="flex gap-2">{[{ id: 'LOW', label: 'Low' }, { id: 'NORMAL', label: 'Normal' }, { id: 'HIGH', label: 'High' }, { id: 'URGENT', label: 'Urgent' }].map((opt) => <button key={opt.id} type="button" aria-pressed={priority === opt.id} onClick={() => setPriority(opt.id)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${priority === opt.id ? (opt.id === 'URGENT' ? 'border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200' : opt.id === 'HIGH' ? 'border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'border-indigo-300 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200') : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{opt.label}</button>)}</div></div>
      </Surface>
      <div className="space-y-3"><Surface className="p-3.5"><p className="text-sm font-bold text-slate-900">For {selectedClass.name}</p><p className="mt-1 text-xs text-slate-600">Parents in this school will see this in their child\u2019s diary feed.</p></Surface><div className="flex flex-col gap-2"><button type="submit" disabled={submitting || !subject.trim() || !content.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 py-3 text-sm font-bold text-white hover:bg-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50 transition-colors">{submitting ? <><Loader2 size={16} className="animate-spin" /> Publishing\u2026</> : <><MessageSquare size={16} /> {publishLabel}</>}</button><button type="button" onClick={onBack} className="min-h-10 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Cancel</button></div></div>
    </form>
  </div>;
}

function AssessmentWorkspace({ selectedClass }) {
  const [assessed, setAssessed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAssessments = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await assessmentAPI.getFormative({ classId: selectedClass.id });
      if (resp?.success === false) throw new Error(resp.error || resp.message || 'Failed to load assessments');
      setAssessed(resp?.data || []);
    } catch (err) {
      console.error('Failed to fetch assessments:', err);
      setError(err?.message || 'Could not load assessments.');
      setAssessed([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [selectedClass.id]);

  return <div className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><SmallLabel>{selectedClass.name}</SmallLabel><h2 className="mt-1 text-xl font-black tracking-tight">Record scores</h2><p className="mt-1 text-sm text-slate-700">Enter each learner's score, then review your assessment.</p></div></div>
    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h3 className="font-extrabold text-slate-950">Recent assessments · {selectedClass.name}</h3>{loading && <Loader2 size={14} className="animate-spin text-slate-400" />}</div>
      {error && <div className="flex items-start gap-2 border-b border-slate-100 bg-amber-50 px-4 py-3 text-xs text-amber-900"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</div>}
      {!loading && assessed.length === 0 && <div className="px-4 py-6 text-center"><p className="text-xs text-slate-500">No assessments recorded yet.</p></div>}
      <div className="divide-y divide-slate-100">
        {assessed.map((item) => {
          const learner = item.learner || item;
          const learnerName = learner.name || `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Learner';
          const initials = (learnerName.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '?';
          const area = item.learningArea || item.subject || item.area || '—';
          const score = item.score != null ? `${item.score} / ${item.outOf || item.maxScore || 20}` : '—';
          const state = item.score != null ? 'Recorded' : 'To assess';
          return <div key={item.id || learnerName} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-700">{initials}</div><div className="min-w-[130px] flex-1"><p className="text-sm font-bold text-slate-900">{learnerName}</p><p className="text-xs text-slate-600">{area}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state === 'Recorded' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{state}</span><span className="min-w-20 text-right text-sm font-extrabold text-slate-900">{score}</span></div>;
        })}
      </div>
    </Surface>
  </div>;
}

function AttendanceWorkspace({ selectedClass }) {
  const [learners, setLearners] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const options = [{ id: 'P', label: 'Present', color: 'border-emerald-200 text-emerald-700' }, { id: 'L', label: 'Late', color: 'border-amber-200 text-amber-700' }, { id: 'A', label: 'Absent', color: 'border-rose-200 text-rose-700' }, { id: 'S', label: 'Sick', color: 'border-orange-200 text-orange-700' }, { id: 'E', label: 'Excused', color: 'border-sky-200 text-sky-700' }];
  const statusMap = { P: 'PRESENT', L: 'LATE', A: 'ABSENT', S: 'SICK', E: 'EXCUSED' };

  const fetchLearners = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await attendanceAPI.getDailyClassReport(selectedClass.id, today);
      if (resp?.success === false) throw new Error(resp.error || resp.message || 'Failed to load class roster');
      const list = (resp?.data?.records || resp?.data?.learners || resp?.data || []);
      const mapped = Array.isArray(list) ? list : [];
      setLearners(mapped);
      const existing = {};
      mapped.forEach((l) => {
        const id = l.id || l.learnerId;
        const status = (l.status || l.attendanceStatus || '').toUpperCase();
        const code = Object.entries(statusMap).find(([_, v]) => v === status)?.[0] || '';
        if (code) existing[id] = code;
      });
      setMarks(existing);
    } catch (err) {
      console.error('Failed to fetch attendance roster:', err);
      setError(err?.message || 'Could not load class roster for attendance.');
      setLearners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearners();
  }, [selectedClass.id, today]);

  const setMark = (id, value) => setMarks((current) => ({ ...current, [id]: value }));

  const handleSave = async () => {
    const entries = Object.entries(marks).filter(([_, code]) => code);
    if (!entries.length) return;
    setSaving(true);
    try {
      const records = entries.map(([learnerId, code]) => ({
        learnerId,
        classId: selectedClass.id,
        date: today,
        status: statusMap[code] || 'PRESENT',
      }));
      const resp = await attendanceAPI.markBulk({ records });
      if (resp?.success === false) throw new Error(resp.error || resp.message || 'Failed to save attendance');
    } catch (err) {
      console.error('Failed to save attendance:', err);
      setError(err?.message || 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const markedCount = Object.values(marks).filter(Boolean).length;

  return <div className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><SmallLabel>{selectedClass.name} · {formatDate(new Date())}</SmallLabel><h2 className="mt-1 text-xl font-black tracking-tight">Take attendance</h2><p className="mt-1 text-sm text-slate-700">Choose a status for each learner.</p></div><div className="text-right"><span className="block text-sm font-bold text-slate-800">{learners.length} learners in class</span></div></div>
    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5"><h3 className="text-sm font-bold text-slate-900">Mark today's register</h3>{loading && <Loader2 size={14} className="animate-spin text-slate-400" />}{!loading && <div className="flex gap-2 text-xs"><span className="font-bold text-emerald-800">{Object.values(marks).filter((mark) => mark === 'P').length} present</span><span className="font-bold text-amber-900">{Object.values(marks).filter((mark) => mark === 'L').length} late</span></div>}</div>
      {error && <div className="flex items-start gap-2 border-b border-slate-100 bg-amber-50 px-4 py-3 text-xs text-amber-900"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</div>}
      {!loading && learners.length === 0 && <div className="px-4 py-6 text-center"><p className="text-xs text-slate-500">No learners found in this class.</p></div>}
      <div className="divide-y divide-slate-100">
        {learners.map((learner) => {
          const id = learner.id || learner.learnerId;
          const name = learner.name || `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Learner';
          const initials = (name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '?';
          return <div key={id} className="flex flex-wrap items-center gap-2.5 px-3 py-3 sm:px-4"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-700">{initials}</div><div className="min-w-[120px] flex-1"><p className="text-sm font-bold text-slate-900">{name}</p></div><div className="flex gap-1">{options.map((option) => <button key={option.id} title={option.label} aria-label={`${option.label}: ${name}`} aria-pressed={marks[id] === option.id} onClick={() => setMark(id, option.id)} className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition ${marks[id] === option.id ? 'border-indigo-900 bg-indigo-900 text-white shadow-sm' : `${option.color} bg-white hover:bg-slate-50`}`}>{option.id}</button>)}</div></div>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3"><p className="text-xs text-slate-700">{markedCount} of {learners.length} marked</p><button onClick={handleSave} disabled={saving || markedCount === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#172554] px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Save register</button></div>
    </Surface>
  </div>;
}

function ClassPlanWorkspace({ selectedClass, schedule = [], dashboardLoading = false, onNavigate }) {
  const periods = schedule.length
    ? schedule.map((item) => ({
        time: item.startTime && item.endTime ? `${item.startTime} – ${item.endTime}` : item.time || '',
        subject: item.subject || item.learningArea || 'Lesson',
        detail: item.className || item.room ? `${item.className || selectedClass.name}${item.room ? ' · Room ' + item.room : ''}` : selectedClass.name,
      }))
    : [];
  return <div className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><SmallLabel>{selectedClass.name}</SmallLabel><h2 className="mt-1 text-xl font-black tracking-tight">Class Plan</h2><p className="mt-1 text-sm text-slate-700">Check your lessons and plan what comes next.</p></div></div><Surface className="overflow-hidden"><h3 className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-950">Today's lessons</h3>{dashboardLoading ? <div className="flex items-center gap-2 px-4 py-6 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading schedule...</div> : periods.length === 0 ? <div className="px-4 py-6 text-center text-xs text-slate-500">No lessons scheduled for today.</div> : <div className="divide-y divide-slate-100">{periods.map((period, index) => <div key={`${period.time}-${index}`} className="flex gap-3 px-4 py-3"><span className="w-24 shrink-0 pt-0.5 text-xs font-bold text-slate-700">{period.time}</span><div className="border-l-2 border-indigo-300 pl-3"><p className="text-sm font-bold text-slate-900">{period.subject}</p><p className="mt-0.5 text-xs text-slate-600">{period.detail}</p></div></div>)}</div>}</Surface><div><h3 className="mb-1 px-1 text-sm font-bold text-slate-900">Plan and prepare</h3><div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{[{ title: 'Plan a scheme of work', icon: ClipboardList, page: 'planner-schemes' }, { title: 'Prepare a lesson', icon: BookOpen, page: 'learning-hub-lesson-plans' }, { title: 'Create a quiz or activity', icon: Activity, page: 'learning-interactive' }, { title: 'Find revision resources', icon: FileText, page: 'learning-revision' }].map(({ title, icon: Icon, page }) => <button key={title} onClick={() => onNavigate?.(page)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700"><Icon size={19} className="text-indigo-800" /><span className="flex-1 text-sm font-semibold text-slate-950">{title}</span><ChevronRight size={17} className="text-slate-600" /></button>)}</div></div></div>;
}

function PreviewNotice() {
  return <p className="flex items-center gap-2 text-xs text-slate-700"><Circle size={9} className="text-indigo-700" /> Preview only. Nothing is saved or sent.</p>;
}
