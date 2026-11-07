import React, { useMemo, useState } from 'react';
import {
  AlertCircle, BookOpen, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardList, FileText, Users, X,
} from 'lucide-react';

const PREVIEW_RECORDS = [
  {
    id: 'g7a', className: 'Grade 7 A', teacher: 'Esther Njeru', subject: 'Mathematics',
    note: 'Learners practised equivalent fractions in pairs. Most groups explained their method clearly.',
    diaryStatus: 'Complete', noteTime: '10:42 am', assignments: [
      { title: 'Fractions practice set 4', kind: 'Daily homework', due: 'Today, 4:00 pm', submitted: 21, paperDone: 4, overdue: 1, unmarked: 2, roster: 28 },
      { title: 'Mental maths review', kind: 'Daily homework', due: 'Tomorrow', submitted: 24, paperDone: 2, overdue: 0, unmarked: 0, roster: 28 },
    ],
  },
  {
    id: 'g7b', className: 'Grade 7 B', teacher: 'Peter Otieno', subject: 'Mathematics',
    note: 'Reviewed fraction comparison and corrected common errors from yesterday’s exercise.',
    diaryStatus: 'Complete', noteTime: '11:05 am', assignments: [
      { title: 'Compare the fractions', kind: 'Daily homework', due: 'Today, 5:00 pm', submitted: 17, paperDone: 5, overdue: 2, unmarked: 2, roster: 26 },
    ],
  },
  {
    id: 'g6a', className: 'Grade 6 A', teacher: 'Mercy Wanjiku', subject: 'Science',
    note: '', diaryStatus: 'Missing', noteTime: '', assignments: [
      { title: 'Materials around us', kind: 'Daily homework', due: 'Today, 4:00 pm', submitted: 18, paperDone: 3, overdue: 1, unmarked: 2, roster: 31 },
    ],
  },
  {
    id: 'g5b', className: 'Grade 5 B', teacher: 'Daniel Kipchumba', subject: 'English',
    note: 'Read the short passage and identified new vocabulary as a class.',
    diaryStatus: 'Complete', noteTime: '9:18 am', assignments: [
      { title: 'Reading journal: week 2', kind: 'Holiday homework', due: '14 Nov', submitted: 19, paperDone: 3, overdue: 0, unmarked: 2, roster: 27 },
    ],
  },
  {
    id: 'g4a', className: 'Grade 4 A', teacher: 'Lydia Achieng', subject: 'Kiswahili',
    note: '', diaryStatus: 'Missing', noteTime: '', assignments: [],
  },
  {
    id: 'g8a', className: 'Grade 8 A', teacher: 'Esther Njeru', subject: 'Mathematics',
    note: 'Worked through a guided example on ratios before independent practice.',
    diaryStatus: 'Complete', noteTime: '1:12 pm', assignments: [
      { title: 'Ratio word problems', kind: 'Daily homework', due: 'Tomorrow', submitted: 20, paperDone: 2, overdue: 0, unmarked: 3, roster: 29 },
      { title: 'Holiday reading list', kind: 'Holiday homework', due: '14 Nov', submitted: 13, paperDone: 4, overdue: 0, unmarked: 5, roster: 29 },
    ],
  },
];

const formatToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function SummaryCard({ icon: Icon, label, value, detail, tone }) {
  return <div className="flex min-h-[84px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${tone}`}><Icon size={19} /></span>
    <div className="min-w-0"><p className="text-xs font-semibold text-slate-600">{label}</p><p className="text-lg font-black leading-tight text-slate-950">{value}</p><p className="truncate text-[11px] text-slate-600">{detail}</p></div>
  </div>;
}

function ProgressBar({ done, total }) {
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{ width: `${percent}%` }} /></div>;
}

function RecordDetail({ record, onClose }) {
  if (!record) return null;
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`${record.className} diary details`} onMouseDown={onClose}>
    <section className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl" onMouseDown={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div><p className="text-xs font-bold text-indigo-800">{record.className} · {record.subject}</p><h2 className="mt-1 text-lg font-black text-slate-950">Diary and assignment progress</h2><p className="mt-0.5 text-xs text-slate-600">Teacher: {record.teacher}</p></div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18} /></button>
      </header>
      <div className="mt-3 space-y-3">
        <div className={`rounded-xl border p-3 ${record.diaryStatus === 'Missing' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2"><FileText size={17} className={record.diaryStatus === 'Missing' ? 'text-amber-800' : 'text-blue-800'} /><h3 className="text-sm font-extrabold text-slate-950">Class diary</h3><span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${record.diaryStatus === 'Missing' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{record.diaryStatus}</span></div>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">{record.note || 'No class note recorded in this preview.'}</p>
          {record.noteTime && <p className="mt-1 text-[11px] text-slate-600">Recorded at {record.noteTime} by {record.teacher}</p>}
        </div>
        <div><h3 className="mb-2 text-sm font-extrabold text-slate-950">Issued work <span className="font-semibold text-slate-600">({record.assignments.length})</span></h3>
          {record.assignments.length ? <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{record.assignments.map(item => {
            const reported = item.submitted + item.paperDone;
            return <article key={item.title} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-bold text-slate-950">{item.title}</h4><p className="mt-0.5 text-xs text-slate-600">{item.kind} · Due {item.due}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{reported} / {item.roster} reported</span></div>
              <ProgressBar done={reported} total={item.roster} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]"><span className="text-blue-800">{item.submitted} submitted online</span><span className="text-emerald-800">{item.paperDone} done on paper</span>{item.overdue > 0 && <span className="text-rose-800">{item.overdue} overdue</span>}{item.unmarked > 0 && <span className="text-amber-900">{item.unmarked} unmarked</span>}</div>
            </article>;
          })}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">No homework issued in this preview.</p>}
        </div>
        <section className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="text-xs font-extrabold text-slate-900">Activity history · sample</h3><p className="mt-1 text-xs text-slate-700">{record.diaryStatus === 'Complete' ? `Class note · created by ${record.teacher} · latest update ${record.noteTime}.` : 'No class note has been recorded for this class and date.'}</p>{record.assignments.map(item => <p key={item.title} className="mt-1 text-xs text-slate-700">{item.kind} “{item.title}” issued by {record.teacher}.</p>)}</section>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-950">Preview only. Detailed learner marks and private feedback stay in each learner’s permitted view. This screen does not edit teacher records.</p>
      </div>
    </section>
  </div>;
}

export default function DigitalDiaryLeadershipPage({ user }) {
  const [date, setDate] = useState(formatToday);
  const [classFilter, setClassFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const classes = useMemo(() => [...new Set(PREVIEW_RECORDS.map(item => item.className))], []);
  const teachers = useMemo(() => [...new Set(PREVIEW_RECORDS.map(item => item.teacher))], []);
  const filtered = useMemo(() => PREVIEW_RECORDS.filter(record => {
    if (date !== formatToday()) return false;
    if (classFilter !== 'all' && record.className !== classFilter) return false;
    if (teacherFilter !== 'all' && record.teacher !== teacherFilter) return false;
    if (typeFilter === 'missing' && record.diaryStatus !== 'Missing') return false;
    if (typeFilter === 'notes' && !record.note) return false;
    if (typeFilter === 'daily' && !record.assignments.some(item => item.kind === 'Daily homework')) return false;
    if (typeFilter === 'holiday' && !record.assignments.some(item => item.kind === 'Holiday homework')) return false;
    return true;
  }), [classFilter, teacherFilter, typeFilter, date]);

  const missingCount = filtered.filter(item => item.diaryStatus === 'Missing').length;
  const completeCount = filtered.length - missingCount;
  const assignmentCount = filtered.reduce((count, item) => count + item.assignments.length, 0);
  const learnerTotal = filtered.reduce((count, item) => count + item.assignments.reduce((sum, assignment) => sum + assignment.roster, 0), 0);
  const reportedTotal = filtered.reduce((count, item) => count + item.assignments.reduce((sum, assignment) => sum + assignment.submitted + assignment.paperDone, 0), 0);
  const reviewerName = user?.firstName || user?.name?.split(' ')?.[0] || 'there';

  return <main className="min-h-screen bg-[#f6f8fc] px-3 py-4 pb-24 text-slate-900 sm:px-5 lg:px-7 lg:pb-6">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold text-indigo-800">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {reviewerName}</p><h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">School Diary Overview</h1><p className="mt-1 text-sm text-slate-700">Review class notes and follow assignment progress across the school.</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-950"><AlertCircle size={13} /> UI preview · sample data</span>
      </header>

      <section aria-label="Diary filters" className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] font-bold text-slate-700">Diary date<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none" /></label>
        <label className="text-[11px] font-bold text-slate-700">Class<select value={classFilter} onChange={event => setClassFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none"><option value="all">All classes</option>{classes.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="text-[11px] font-bold text-slate-700">Teacher<select value={teacherFilter} onChange={event => setTeacherFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none"><option value="all">All teachers</option>{teachers.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="text-[11px] font-bold text-slate-700">Show<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none"><option value="all">All diary activity</option><option value="missing">Missing diary entries</option><option value="notes">Class notes</option><option value="daily">Daily homework</option><option value="holiday">Holiday homework</option></select></label>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="School diary summary">
        <SummaryCard icon={BookOpen} label="Class diary entries" value={`${completeCount} / ${filtered.length}`} detail={`${missingCount} class${missingCount === 1 ? '' : 'es'} need an entry`} tone="bg-blue-700" />
        <SummaryCard icon={AlertCircle} label="Missing entries" value={missingCount} detail="Review class and date" tone={missingCount ? 'bg-rose-700' : 'bg-emerald-700'} />
        <SummaryCard icon={ClipboardList} label="Assignments issued" value={assignmentCount} detail="Daily and holiday homework" tone="bg-violet-700" />
        <SummaryCard icon={Users} label="Work reported" value={`${reportedTotal} / ${learnerTotal}`} detail="Online submissions + paper done" tone="bg-teal-700" />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 sm:px-4"><div><h2 className="text-sm font-extrabold text-slate-950">Classes and diary activity</h2><p className="mt-0.5 text-xs text-slate-600">Select a class to inspect its note and issued work.</p></div><span className="text-xs font-semibold text-slate-600">{filtered.length} classes</span></div>
        {date !== formatToday() ? <div className="p-8 text-center"><CalendarDays size={24} className="mx-auto text-slate-500" /><p className="mt-2 text-sm font-bold text-slate-800">No sample activity for this date</p><p className="mt-1 text-xs text-slate-600">Choose today to view the preview records.</p></div> : filtered.length ? <div className="divide-y divide-slate-100">
          {filtered.map(record => {
            const assignmentTotal = record.assignments.length;
            const roster = record.assignments.reduce((sum, assignment) => sum + assignment.roster, 0);
            const reported = record.assignments.reduce((sum, assignment) => sum + assignment.submitted + assignment.paperDone, 0);
            const overdue = record.assignments.reduce((sum, assignment) => sum + assignment.overdue, 0);
            const unmarked = record.assignments.reduce((sum, assignment) => sum + assignment.unmarked, 0);
            return <button key={record.id} type="button" onClick={() => setSelected(record)} className="grid w-full grid-cols-1 gap-2 px-3 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700 sm:grid-cols-[minmax(140px,1.1fr)_minmax(120px,1fr)_minmax(145px,1fr)_minmax(140px,1fr)_auto] sm:items-center sm:px-4">
              <span className="min-w-0"><span className="block truncate text-sm font-extrabold text-slate-950">{record.className}</span><span className="block truncate text-xs text-slate-600">{record.subject}</span></span>
              <span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800">{record.teacher}</span><span className="block text-[10px] text-slate-600">{record.noteTime ? `Updated ${record.noteTime}` : 'No entry recorded'}</span></span>
              <span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${record.diaryStatus === 'Missing' ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>{record.diaryStatus === 'Missing' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}{record.diaryStatus === 'Missing' ? 'Diary missing' : 'Diary complete'}</span><span className="mt-1 block text-[10px] text-slate-600">{assignmentTotal} assignment{assignmentTotal === 1 ? '' : 's'}</span></span>
              <span className="min-w-0">{assignmentTotal ? <><span className="text-xs font-bold text-slate-800">{reported} / {roster} reported</span><ProgressBar done={reported} total={roster} /><span className="mt-1 block text-[10px] text-slate-600">{overdue} overdue · {unmarked} unmarked</span></> : <span className="text-xs text-slate-600">No work issued</span>}</span>
              <ChevronRight size={18} className="hidden text-slate-500 sm:block" />
            </button>;
          })}
        </div> : <div className="p-8 text-center"><BookOpen size={24} className="mx-auto text-slate-500" /><p className="mt-2 text-sm font-bold text-slate-800">No classes match these filters</p><button type="button" onClick={() => { setClassFilter('all'); setTeacherFilter('all'); setTypeFilter('all'); }} className="mt-2 text-xs font-bold text-indigo-800 underline">Clear filters</button></div>}
      </section>
      <p className="text-[11px] text-slate-600">Preview only. Counts and diary entries are sample data; this screen does not alter teacher records.</p>
    </div>
    <RecordDetail record={selected} onClose={() => setSelected(null)} />
  </main>;
}
