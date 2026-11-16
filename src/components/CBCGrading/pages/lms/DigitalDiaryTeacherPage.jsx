import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api, { configAPI, dashboardAPI } from '../../../../services/api';
import { useTeacherContext } from '../../../../hooks/useTeacherContext';
import ClockInStatusWidget from '../../dashboard/widgets/teacher/ClockInStatusWidget';
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookOpen, Calendar,
  CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, FileText, Loader2, MessageSquare, Pencil, Trash2,
  Users, AlertCircle,
} from 'lucide-react';

function formatDate(date) {
  return new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function Surface({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,.035)] ${className}`}>{children}</section>;
}

function SmallLabel({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{children}</p>;
}

function getDiaryLearningAreaOptions(subjects = []) {
  const options = (Array.isArray(subjects) ? subjects : [])
    .map((subject) => typeof subject === 'string'
      ? subject.trim()
      : String(subject?.name || subject?.label || '').trim())
    .filter((subject) => subject && !/^(class\s*teacher|class|assigned class|daily attendance)$/i.test(subject));

  return [...new Map(options.map((subject) => [subject.toLowerCase(), subject])).values()];
}

function getHomeworkTitleParts(title, learningAreaOptions) {
  const rawTitle = String(title || '').trim();
  const separator = rawTitle.indexOf(':');
  if (separator < 1) return { learningArea: '', title: rawTitle };

  const titleArea = rawTitle.slice(0, separator).trim();
  const assignedArea = learningAreaOptions.find((area) => area.toLowerCase() === titleArea.toLowerCase());
  return assignedArea
    ? { learningArea: assignedArea, title: rawTitle.slice(separator + 1).trim() }
    : { learningArea: '', title: rawTitle };
}

export default function DigitalDiaryTeacherPage({ user, onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('today');
  const [mobileHomeOpen, setMobileHomeOpen] = useState(true);
  const [entryPage, setEntryPage] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [lmsFormOptions, setLmsFormOptions] = useState({ classes: [], learningAreas: [] });
  const [learningAreaOptionsLoading, setLearningAreaOptionsLoading] = useState(true);
  const [learningAreaOptionsError, setLearningAreaOptionsError] = useState('');
  const teacherContext = useTeacherContext();
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
  const classOptions = assignedClasses.map((item, index) => ({
    id: String(item.id || `assigned-${index}`),
    name: item.name || 'Assigned class',
    count: Number(item.learnerCount || 0),
  }));
  const selectedClass = classOptions.find((item) => item.id === classId) || classOptions[0] || null;

  const learningAreaOptions = useMemo(() => {
    if (!selectedClass) return [];
    const configuredClass = lmsFormOptions.classes.find((item) => String(item.id) === selectedClass.id);
    if (!configuredClass) return [];
    if (teacherContext.error) return [];

    const gradeAreas = lmsFormOptions.learningAreas.filter(
      (area) => String(area.gradeLevel || '') === String(configuredClass.grade || ''),
    );
    if (!teacherContext.restricted || String(teacherContext.classTeacherOf?.id || '') === selectedClass.id) {
      return getDiaryLearningAreaOptions(gradeAreas);
    }

    const allowedAreaIds = new Set(
      (teacherContext.subjectAssignments || [])
        .filter((assignment) => (
          String(assignment.classId || '') === selectedClass.id ||
          (!assignment.classId && String(assignment.grade || '') === String(configuredClass.grade || ''))
        ))
        .map((assignment) => String(assignment.learningAreaId || '')),
    );
    return getDiaryLearningAreaOptions(gradeAreas.filter((area) => allowedAreaIds.has(String(area.id))));
  }, [lmsFormOptions, selectedClass, teacherContext.error, teacherContext.restricted, teacherContext.classTeacherOf, teacherContext.subjectAssignments]);

  useEffect(() => {
    let isMounted = true;
    configAPI.getLmsFormOptions()
      .then(({ options, failed }) => {
        if (!isMounted) return;
        setLmsFormOptions({
          classes: options.classes || [],
          learningAreas: options.learningAreas || [],
        });
        if (failed.includes('classes') || failed.includes('learningAreas')) {
          setLearningAreaOptionsError('Could not load the school learning areas. Refresh the page and try again.');
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Failed to load diary learning areas:', error);
        setLearningAreaOptionsError('Could not load the school learning areas. Refresh the page and try again.');
      })
      .finally(() => {
        if (isMounted) setLearningAreaOptionsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const loadDashboard = useCallback(() => {
    setDashboardLoading(true);
    setDashboardError('');
    dashboardAPI.getTeacherMetrics('today')
      .then((response) => {
        if (response?.success) setDashboard(response.data || {});
        else setDashboardError(response?.message || 'Daily teacher overview is unavailable.');
      })
      .catch((error) => {
        setDashboardError(error?.message || 'Could not load your daily teacher overview.');
      })
      .finally(() => setDashboardLoading(false));
  }, [user?.id, user?.userId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Once the dashboard returns real classes, auto-select the first one
  useEffect(() => {
    if (!classId && classOptions.length) setClassId(classOptions[0].id);
  }, [classOptions, classId]);

  const nextAction = dashboard?.nextAction;

  const shiftDate = (amount) => setSelectedDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount));

  const showToast = (message, tone = 'info') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(''), 4000);
  };

  const handlePublished = (noticeTitle, className, wasEdited = false) => {
    showToast(`"${noticeTitle}" ${wasEdited ? 'updated' : 'published'} for ${className} families.`, 'success');
    setEntryPage(null);
    setEditingEntry(null);
  };

  const handleCompose = (kind) => {
    if (kind === 'daily' || kind === 'holiday') {
      onNavigate?.('learning-assignment-create', {
        classId: selectedClass?.id,
        category: kind === 'holiday' ? 'HOLIDAY_WORK' : 'HOMEWORK',
      });
      return;
    }
    setEditingEntry(null);
    setEntryPage(kind);
  };

  const handleEditHomework = (entry) => {
    setEditingEntry(entry);
    setEntryPage('daily');
  };

  const handlePublishError = (message) => {
    showToast(message || 'Could not publish. Please try again.', 'error');
  };

  const tabs = [
    { id: 'today', label: 'My Day Today', icon: CalendarDays, color: 'bg-[#2563eb]', tint: 'bg-blue-50', border: 'border-blue-500' },
    { id: 'plan', label: 'Class Plan', icon: Calendar, color: 'bg-[#16a34a]', tint: 'bg-emerald-50', border: 'border-emerald-500' },
    { id: 'entries', label: 'Diary Entries', icon: MessageSquare, color: 'bg-[#9333ea]', tint: 'bg-purple-50', border: 'border-purple-500' },
  ];

  return (
    <main data-active-workspace-page={activeTab} className="min-h-[calc(100vh-80px)] bg-[#f6f8fc] px-3 pt-3 pb-24 text-slate-900 sm:px-5 lg:px-7 lg:pb-3">
      <div className="mx-auto max-w-[1380px] space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172554] text-white"><BookOpen size={18} /></div><div><div className="flex items-center gap-2"><h1 className="text-xl font-black tracking-tight text-slate-950">Teacher Workspace</h1></div></div></div>
          <div className={`flex flex-wrap items-center gap-2 ${mobileHomeOpen ? 'hidden md:flex' : ''}`}>
            {selectedClass ? (
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"><Users size={15} className="text-indigo-600" /><select aria-label="Select class" value={selectedClass.id} disabled={Boolean(editingEntry)} onChange={(event) => setClassId(event.target.value)} className="max-w-[150px] bg-transparent text-xs font-bold text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-60">{classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} className="text-slate-400" /></label>
            ) : (
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{dashboardLoading ? 'Loading classes…' : 'No classes assigned'}</span>
            )}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => shiftDate(-1)} aria-label="Previous day" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowLeft size={14} /></button><button onClick={() => setSelectedDate(new Date())} className="px-2 text-[11px] font-bold text-slate-700">{new Intl.DateTimeFormat('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }).format(selectedDate)}</button><button onClick={() => shiftDate(1)} aria-label="Next day" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowRight size={14} /></button></div>
          </div>
        </header>

        <section aria-label="Teacher greeting and clock in" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4">
          <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950">{greetingEmoji} {greeting}, {teacherFirstName}</p><p className="mt-0.5 text-xs text-slate-600">Ready for today’s classes?</p></div>
          <ClockInStatusWidget user={user} variant="compact" />
        </section>

        <nav className="hidden overflow-x-auto px-1 py-1 scrollbar-none lg:block" aria-label="Teacher workspace and modules">
          <div className="flex min-w-max items-center gap-2.5">
            <div role="tablist" aria-label="Teacher workspace sections" className="flex items-center gap-2.5">
              {tabs.map(({ id, label, icon: Icon, color }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => { setActiveTab(id); setMobileHomeOpen(false); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 sm:px-5 sm:text-sm ${color} ${activeTab === id ? 'ring-2 ring-slate-900 ring-offset-2' : 'opacity-90 hover:opacity-100'}`}><Icon size={16} />{label}</button>)}
            </div>
            <button type="button" onClick={() => onNavigate?.('assess-summative-assessment')} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#dc2626] px-4 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 sm:px-5 sm:text-sm"><Activity size={16} />Record Scores</button>
            <button type="button" onClick={() => onNavigate?.('attendance-daily')} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0f766e] px-4 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 sm:px-5 sm:text-sm"><Check size={16} />Take Attendance</button>
          </div>
        </nav>

        {mobileHomeOpen && <MobileWorkspaceMenu
          onSelect={(id) => { setActiveTab(id); setEntryPage(null); setMobileHomeOpen(false); }}
          onCompose={(kind) => { setActiveTab('entries'); handleCompose(kind); setMobileHomeOpen(false); }}
          onNavigate={onNavigate}
        />}

        {!mobileHomeOpen && <div className="mb-2 lg:hidden"><button type="button" onClick={() => { setActiveTab('today'); setEntryPage(null); setMobileHomeOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-indigo-800 hover:bg-white"><ArrowLeft size={16} /> Teacher Workspace</button></div>}

        {activeTab === 'today' && <div className={`${mobileHomeOpen ? 'hidden lg:block' : ''} space-y-3`}>
          <div className="grid gap-1 rounded-xl border border-slate-200 bg-white px-3 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">{[{ icon: Users, label: 'My learners', value: dashboardLoading ? '…' : dashboardError ? '—' : (teacherStats.myStudents ?? 0), page: 'teacher-learner-analysis' }, { icon: Check, label: 'Registers to complete', value: dashboardLoading ? '…' : dashboardError ? '—' : attendanceDue.length, page: 'attendance-daily' }, { icon: ClipboardList, label: 'Scores to review', value: dashboardLoading ? '…' : dashboardError ? '—' : assessmentsToMark.length, page: 'assess-summative-assessment' }].map(({ icon: Icon, label, value, page }) => <button key={label} onClick={() => onNavigate?.(page)} className="flex min-h-14 items-center gap-2.5 px-2 text-left hover:bg-slate-50 sm:px-3"><Icon size={16} className="shrink-0 text-indigo-700" /><span className="min-w-0 flex-1 text-xs font-semibold text-slate-700">{label}</span><span className="text-sm font-extrabold text-slate-950">{value}</span><ChevronRight size={14} className="text-slate-500" /></button>)}</div>
          {dashboardError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Daily overview unavailable. Refresh to try again.</p>}
          <Surface className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><SmallLabel>UP NEXT</SmallLabel><h2 className="mt-0.5 text-sm font-extrabold">Your day</h2></div><span className="text-[11px] font-semibold text-slate-600">{formatDate(selectedDate)}</span></div><div className="grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-slate-100"><div className="p-4">{dashboardLoading ? <p className="text-xs text-slate-700">Loading daily tasks…</p> : nextAction ? <button onClick={() => onNavigate?.(nextAction.navigateTo)} className="flex w-full items-start gap-3 rounded-xl bg-indigo-50 p-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2939a7] text-white"><Bell size={15} /></span><span><strong className="block text-xs text-slate-950">{nextAction.title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-slate-700">{nextAction.description}</span><span className="mt-1.5 block text-[11px] font-bold text-indigo-900">{nextAction.actionLabel}</span></span></button> : <p className="text-xs text-slate-700">No urgent tasks are waiting.</p>}</div><div className="p-4"><div className="flex items-center justify-between"><SmallLabel>TODAY’S CLASSES</SmallLabel><button onClick={() => setActiveTab('plan')} className="text-[11px] font-bold text-indigo-800">Class plan <ChevronRight size={12} className="inline" /></button></div>{schedule.length ? <div className="mt-1 divide-y divide-slate-100">{schedule.slice(0, 3).map((item, index) => <div key={`${item.id || item.subject}-${index}`} className="flex items-center justify-between gap-2 py-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{item.subject || item.learningArea || 'Lesson'}</p><p className="truncate text-[10px] text-slate-600">{item.className || item.class?.name || item.class?.stream || 'Assigned class'}</p></div><span className="shrink-0 text-[10px] font-semibold text-slate-700">{item.time || item.startTime || ''}</span></div>)}</div> : <p className="mt-2 text-xs text-slate-700">{dashboardLoading ? 'Loading schedule…' : 'No lessons scheduled today.'}</p>}</div></div></Surface>
        </div>}

        {activeTab === 'plan' && selectedClass && <ClassPlanWorkspace selectedClass={selectedClass} schedule={schedule} dashboardLoading={dashboardLoading} onNavigate={onNavigate} />}
        {activeTab === 'entries' && selectedClass && (entryPage
          ? entryPage !== 'note' && (learningAreaOptionsLoading || teacherContext.loading)
            ? <Surface className="flex items-center gap-2 p-4 text-sm font-semibold text-slate-700"><Loader2 size={16} className="animate-spin text-indigo-700" />Loading your assigned learning areas…</Surface>
          : <DiaryEntryComposerPage key={`${editingEntry?.id || `new-${entryPage}`}-${selectedClass.id}`} kind={entryPage} selectedClass={selectedClass} selectedDate={selectedDate} editingEntry={editingEntry} learningAreaOptions={learningAreaOptions} learningAreaOptionsError={learningAreaOptionsError || (teacherContext.error ? 'Could not verify your teaching assignments. Refresh the page and try again.' : '')} onBack={() => { setEntryPage(null); setEditingEntry(null); }} onPublished={handlePublished} onError={handlePublishError} />
          : <DiaryEntriesWorkspace selectedClass={selectedClass} user={user} onCompose={handleCompose} onEditHomework={handleEditHomework} onHomeworkDeleted={(entry) => showToast(`"${entry.title}" removed from ${selectedClass.name} diary.`, 'success')} />)}
        {!selectedClass && !dashboardLoading && activeTab !== 'today' && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No classes assigned yet</p>
            <p className="mt-1 text-xs text-slate-500">Once an administrator assigns you a class, you can take attendance, record scores, and write diary entries.</p>
          </div>
        )}
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
    { label: 'Record scores', icon: Activity, color: 'bg-[#dc2626]', page: 'assess-summative-assessment' },
    { label: 'Take attendance', icon: Check, color: 'bg-[#0f766e]', page: 'attendance-daily' },
    { label: 'Review my learners', icon: Users, color: 'bg-[#334155]', page: 'teacher-learner-analysis' },
  ];
  return <section className="space-y-3 py-1 lg:hidden" aria-label="Teacher workspace pages">
    <h2 className="px-1 text-base font-extrabold text-slate-950">What would you like to do?</h2>
    <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{tasks.map(({ label, icon: Icon, color, tab, compose, page }) => <button key={label} type="button" onClick={() => page ? onNavigate?.(page) : compose ? onCompose(compose) : onSelect(tab)} className="flex min-h-14 w-full items-center gap-3 px-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${color}`}><Icon size={21} strokeWidth={2.2} /></span><span className="min-w-0 flex-1 text-sm font-bold text-slate-900">{label}</span><ChevronRight size={19} className="shrink-0 text-slate-600" /></button>)}</div>
  </section>;
}

function DiaryEntriesWorkspace({ selectedClass, user, onCompose, onEditHomework, onHomeworkDeleted }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const currentUserId = user?.userId || user?.id;

  const actions = [
    { kind: 'note', title: 'Write a class message', detail: 'Share an update or reminder', icon: MessageSquare, color: 'text-emerald-700 bg-emerald-50' },
    { kind: 'daily', title: 'Set daily homework', detail: 'Create a tracked assignment for this class', icon: BookOpen, color: 'text-blue-700 bg-blue-50' },
    { kind: 'holiday', title: 'Set holiday homework', detail: 'Create a tracked holiday assignment', icon: Calendar, color: 'text-violet-700 bg-violet-50' },
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
          return n.targetClassId === selectedClass.id && (!audience || audience.includes('PARENTS') || audience.includes('STUDENTS'));
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

  const handleDeleteHomework = async (entry) => {
    const confirmed = window.confirm(`Delete "${entry.title}" from ${selectedClass.name}? Families will no longer see it in the diary.`);
    if (!confirmed) return;

    setDeletingId(entry.id);
    setError('');
    try {
      const response = await api.notices.delete(entry.id);
      if (response?.success === false) throw new Error(response.error || response.message || 'Could not delete homework');
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      onHomeworkDeleted?.(entry);
    } catch (err) {
      setError(err?.message || 'Could not delete this homework. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

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
      const title = String(entry.title || '');
      const separator = title.indexOf(':');
      const area = separator > 0 ? title.slice(0, separator).trim() : entry.learningArea || 'Homework';
      const displayTitle = separator > 0 ? title.slice(separator + 1).trim() : title;
      const due = entry.expiresAt
        ? `Due ${new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(new Date(entry.expiresAt))}`
        : '';
      return { type: 'Homework', area, due, displayTitle, accent: 'violet' };
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
          const canManageHomework = meta.type === 'Homework' && entry.createdById === currentUserId;
          return <div key={entry.id} className="flex w-full flex-wrap items-start gap-3 px-4 py-3 text-left">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}><Icon size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-xs text-slate-900">{meta.displayTitle || entry.title}</strong>
                {dateLabel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700">{dateLabel}</span>}
                {meta.type && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">{meta.type}</span>}
              </span>
              <span className="mt-1 block truncate text-xs leading-relaxed text-slate-600">{entry.content}</span>
              {(meta.area || meta.due) && <span className="mt-1 block text-[11px] text-slate-500">{meta.area}{meta.area && meta.due ? ' · ' : ''}{meta.due}</span>}
            </span>
            {canManageHomework && <div className="ml-auto flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => onEditHomework?.(entry)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800" aria-label={`Edit homework ${entry.title}`}>
                <Pencil size={13} /> Edit
              </button>
              <button type="button" onClick={() => handleDeleteHomework(entry)} disabled={deletingId === entry.id} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60" aria-label={`Delete homework ${entry.title}`}>
                {deletingId === entry.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deletingId === entry.id ? 'Deleting' : 'Delete'}
              </button>
            </div>}
          </div>;
        })}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">Visible to learners and families based on the selected audience.</div>
    </Surface>
  </div>;
}

function DiaryEntryComposerPage({ kind, selectedClass, selectedDate, editingEntry, learningAreaOptions, learningAreaOptionsError, onBack, onPublished, onError }) {
  const isMessage = kind === 'note';
  const isHoliday = kind === 'holiday';
  const isEditing = Boolean(editingEntry);
  const initialHomework = getHomeworkTitleParts(editingEntry?.title, learningAreaOptions);

  // ── Form state ──
  const [subject, setSubject] = useState(initialHomework.title);
  const [content, setContent] = useState(editingEntry?.content || '');
  const [learningArea, setLearningArea] = useState(initialHomework.learningArea);
  const [dueDate, setDueDate] = useState(() => editingEntry?.expiresAt ? new Date(editingEntry.expiresAt).toISOString().slice(0, 10) : '');
  const [priority, setPriority] = useState(editingEntry?.priority || 'NORMAL');
  const [completionMode, setCompletionMode] = useState('online');
  const [submitting, setSubmitting] = useState(false);

  const headingText = isEditing ? 'Edit homework' : isMessage ? 'Write a class message' : isHoliday ? 'Set holiday homework' : 'Set daily homework';
  const publishLabel = isEditing ? 'Save changes' : isMessage ? 'Publish message' : 'Publish homework';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !content.trim()) return;
    if (!isMessage && !learningAreaOptions.includes(learningArea)) {
      onError?.('No subject is assigned to you for this class yet. Ask your school admin to assign your learning areas.');
      return;
    }

    // Build the notice payload. targetAudience: 'PARENTS' so it appears in
    // parent diary feeds (server filters by role tokens — see
    // notice.controller.ts isNoticeVisibleTo).
    const payload = {
      title: isMessage ? subject.trim() : `${learningArea}: ${subject.trim()}`,
      content: content.trim(),
      category: isMessage ? 'General' : 'Homework',
      priority,
      status: 'PUBLISHED',
      targetAudience: 'PARENTS',
      targetClassId: selectedClass.id,
      expiresAt: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
    };

    setSubmitting(true);
    try {
      const res = isEditing
        ? await api.notices.update(editingEntry.id, payload)
        : await api.notices.create(payload);
      if (res?.success === false) {
        throw new Error(res?.error || res?.message || `Server rejected the ${isEditing ? 'update' : 'notice'}`);
      }
      onPublished?.(subject.trim(), selectedClass.name, isEditing);
    } catch (err) {
      const msg = err?.message?.includes('403')
        ? `You don\u2019t have permission to ${isEditing ? 'edit this homework' : 'publish diary entries'}. Contact your school admin.`
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
        {!isMessage && <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-600">Learning area
            <select required value={learningArea} disabled={!learningAreaOptions.length} onChange={(e) => setLearningArea(e.target.value)} aria-describedby="diary-learning-area-help" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
              {learningAreaOptions.length
                ? <><option value="">Choose a learning area</option>{learningAreaOptions.map((area) => <option key={area} value={area}>{area}</option>)}</>
                : <option value="">No assigned subjects</option>}
            </select>
            <span id="diary-learning-area-help" className={`mt-1.5 block text-xs ${learningAreaOptions.length ? 'text-slate-500' : 'font-medium text-amber-800'}`}>
              {learningAreaOptions.length
                ? 'Only learning areas assigned to you for this class are listed.'
                : learningAreaOptionsError || 'No learning areas are assigned to you for this class yet. Ask your school admin to assign your subjects before publishing homework.'}
            </span>
          </label>
          <label className="block text-xs font-bold text-slate-600">Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-[11px] text-sm text-slate-800 outline-none focus:border-indigo-500" /></label>
        </div>}
        <label className="block text-xs font-bold text-slate-600">{isMessage ? 'Message subject' : 'Assignment title'}<input required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder={isMessage ? 'e.g. Reminder for tomorrow' : 'e.g. Fractions practice'} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500" /></label>
        <label className="block text-xs font-bold text-slate-600">{isMessage ? 'Message' : 'Instructions for learners'}<textarea required rows={7} value={content} onChange={(e) => setContent(e.target.value)} maxLength={10000} placeholder={isMessage ? 'Write the update or reminder for your class…' : 'Explain the work, how to complete it, and what to submit…'} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500" /></label>
        {!isMessage && <fieldset><legend className="text-xs font-bold text-slate-600">How will learners complete the work?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" aria-pressed={completionMode === 'online'} onClick={() => setCompletionMode('online')} className={`rounded-xl border p-3 text-left ${completionMode === 'online' ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white'}`}><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText size={16} className="text-indigo-600" /> Online submission</span><span className="mt-1 block text-xs text-slate-500">Learners submit work in TrendSCORE</span></button><button type="button" aria-pressed={completionMode === 'paper'} onClick={() => setCompletionMode('paper')} className={`rounded-xl border p-3 text-left ${completionMode === 'paper' ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-200 bg-white'}`}><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><CheckCircle2 size={16} className="text-emerald-600" /> Paper / offline</span><span className="mt-1 block text-xs text-slate-500">Record class completion later</span></button></div></fieldset>}
        <div><p className="text-xs font-bold text-slate-600 mb-2">Priority</p><div className="flex gap-2">{[{ id: 'LOW', label: 'Low' }, { id: 'NORMAL', label: 'Normal' }, { id: 'HIGH', label: 'High' }, { id: 'URGENT', label: 'Urgent' }].map((opt) => <button key={opt.id} type="button" aria-pressed={priority === opt.id} onClick={() => setPriority(opt.id)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${priority === opt.id ? (opt.id === 'URGENT' ? 'border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200' : opt.id === 'HIGH' ? 'border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'border-indigo-300 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200') : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{opt.label}</button>)}</div></div>
      </Surface>
      <div className="space-y-3"><Surface className="p-3.5"><p className="text-sm font-bold text-slate-900">For {selectedClass.name}</p><p className="mt-1 text-xs text-slate-600">Only parents and learners in this class will see this in their diary.</p></Surface><div className="flex flex-col gap-2"><button type="submit" disabled={submitting || !subject.trim() || !content.trim() || (!isMessage && (Boolean(learningAreaOptionsError) || !learningAreaOptions.includes(learningArea)))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 py-3 text-sm font-bold text-white hover:bg-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50 transition-colors">{submitting ? <><Loader2 size={16} className="animate-spin" /> {isEditing ? 'Saving…' : 'Publishing…'}</> : <><MessageSquare size={16} /> {publishLabel}</>}</button><button type="button" onClick={onBack} className="min-h-10 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Cancel</button></div></div>
    </form>
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
