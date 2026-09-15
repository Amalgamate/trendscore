import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, RefreshCw, Users, ShieldCheck, UserX, Clock3, AlertCircle,
  X, Download, ChevronRight, ChevronLeft, Search, Loader2,
} from 'lucide-react';
import { dashboardAPI, attendanceAPI } from '../../../services/api';
import EmptyState from '../shared/EmptyState';

// ── Static config ────────────────────────────────────────────────────────────
const groupCards = [
  ['administrators', 'Administrators', ShieldCheck, 'bg-violet-50 text-violet-700 border-violet-100'],
  ['tutors', 'Tutors', Users, 'bg-sky-50 text-sky-700 border-sky-100'],
  ['supportStaff', 'Support staff', UserX, 'bg-amber-50 text-amber-700 border-amber-100'],
];
const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];

const REGISTER_STATUS_STYLES = {
  COMPLETE: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  NOT_STARTED: 'bg-rose-100 text-rose-700',
};

const STAFF_STATUS_STYLES = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE: 'bg-amber-100 text-amber-700',
  PARTIAL: 'bg-sky-100 text-sky-700',
  NOT_CLOCKED_IN: 'bg-rose-100 text-rose-700',
};

const LEARNER_STATUS_STYLES = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE: 'bg-amber-100 text-amber-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  EXCUSED: 'bg-sky-100 text-sky-700',
  SICK: 'bg-violet-100 text-violet-700',
  NOT_MARKED: 'bg-slate-100 text-slate-500',
};

// ── Small helpers ─────────────────────────────────────────────────────────────
function formatTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function toCsvValue(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => toCsvValue(row[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const Badge = ({ style, children }) => (
  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${style || 'bg-slate-100 text-slate-500'}`}>
    {children}
  </span>
);

// ── Reusable drill-down modal shell ────────────────────────────────────────────
const ReportModal = ({ title, subtitle, onClose, onBack, onExport, exportLabel = 'Export CSV', search, onSearchChange, children }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-2">
            {onBack && (
              <button type="button" onClick={onBack} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="text-base font-black text-slate-950">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                <Download size={13} /> {exportLabel}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
        </div>
        {onSearchChange && (
          <div className="border-b border-slate-100 px-6 py-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-purple focus:outline-none"
              />
            </div>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const OperationsInsightsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'staffGroup'|'allStaff'|'classes'|'classDetail', ... }
  const [modalSearch, setModalSearch] = useState('');
  const [classDetail, setClassDetail] = useState({ loading: false, error: '', data: null, classId: null });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await dashboardAPI.getOperationsInsights();
      if (!response?.success) throw new Error(response?.message || 'Could not load operations insights.');
      setData(response.data);
    } catch (err) { setError(err?.message || 'Could not load operations insights.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openModal = (next, back = null) => { setModalSearch(''); setModal({ ...next, back }); };
  const closeModal = () => { setModal(null); setModalSearch(''); setClassDetail({ loading: false, error: '', data: null, classId: null }); };
  const goBack = () => { if (modal?.back) openModal(modal.back, modal.back.back || null); };

  // Lazily fetch learner-level register when a class row is opened.
  useEffect(() => {
    if (modal?.type !== 'classDetail') return;
    const dateStr = data?.date ? data.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    setClassDetail({ loading: true, error: '', data: null, classId: modal.classId });
    attendanceAPI.getDailyClassReport(modal.classId, dateStr)
      .then((response) => {
        if (!response?.success) throw new Error(response?.message || 'Could not load class register.');
        setClassDetail({ loading: false, error: '', data: response.data, classId: modal.classId });
      })
      .catch((err) => setClassDetail({ loading: false, error: err?.message || 'Could not load class register.', data: null, classId: modal.classId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  const staff = data?.staffAttendance || EMPTY_OBJECT;
  const registers = data?.studentRegisters || EMPTY_OBJECT;
  const classes = registers.classes || EMPTY_ARRAY;
  const coverage = registers.learnersExpected ? Math.round((registers.learnersMarked / registers.learnersExpected) * 100) : 0;

  const allStaffMembers = useMemo(() => (
    groupCards.flatMap(([key, label]) => (staff[key]?.members || []).map((member) => ({ ...member, groupLabel: label })))
  ), [staff]);

  const filteredStaffMembers = useMemo(() => {
    const source = modal?.type === 'staffGroup'
      ? (staff[modal.key]?.members || []).map((member) => ({ ...member, groupLabel: modal.label }))
      : modal?.type === 'allStaff' ? allStaffMembers : [];
    const q = modalSearch.trim().toLowerCase();
    if (!q) return source;
    return source.filter((member) => member.name.toLowerCase().includes(q) || member.roleLabel.toLowerCase().includes(q));
  }, [modal, staff, allStaffMembers, modalSearch]);

  const filteredClasses = useMemo(() => {
    const source = modal?.type === 'classes' && modal.filter ? classes.filter((item) => item.status === modal.filter) : classes;
    const q = modalSearch.trim().toLowerCase();
    if (!q) return source;
    return source.filter((item) => item.className.toLowerCase().includes(q) || (item.teacherName || '').toLowerCase().includes(q));
  }, [modal, classes, modalSearch]);

  const filteredLearners = useMemo(() => {
    const learners = classDetail.data?.learners || [];
    const q = modalSearch.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((l) => `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) || (l.admissionNumber || '').toLowerCase().includes(q));
  }, [classDetail.data, modalSearch]);

  if (loading && !data) return <div className="animate-pulse space-y-5 p-6 lg:p-10"><div className="h-32 rounded-2xl bg-slate-200" /><div className="h-64 rounded-2xl bg-slate-200" /></div>;
  if (error && !data) return <EmptyState icon={AlertCircle} iconSize={42} title="Insights unavailable" message={error} actionText="Retry" onAction={load} />;

  return (
    <main className="min-h-screen bg-[var(--app-page-bg)] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-brand-purple">
                <ClipboardCheck size={20} />
                <span className="text-xs font-black uppercase tracking-[.16em]">System admin reporting</span>
              </div>
              <h1 className="mt-2 text-2xl font-black text-slate-950">Operations Insights</h1>
              <p className="mt-1 text-sm text-slate-500">Today’s attendance picture across your institution — click any card or row to dig into the compiled report.</p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </section>

        {error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}

        {/* ── Staff attendance ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[.14em] text-brand-purple">Staff attendance</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Who is in today?</h2>
            <p className="mt-1 text-sm text-slate-500">Clock-ins are grouped by responsibility. Click a group to see who's in and who's still pending.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {groupCards.map(([key, label, Icon, style]) => {
              const group = staff[key] || {};
              const rate = group.total ? Math.round((group.clockedIn / group.total) * 100) : 0;
              return (
                <article
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => openModal({ type: 'staffGroup', key, label })}
                  onKeyDown={(e) => { if (e.key === 'Enter') openModal({ type: 'staffGroup', key, label }); }}
                  className={`cursor-pointer rounded-xl border p-4 text-left transition hover:shadow-md hover:brightness-[0.98] ${style}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide">{label}</p>
                      <p className="mt-3 text-3xl font-black">{group.clockedIn || 0}<span className="text-base font-bold opacity-60"> / {group.total || 0}</span></p>
                    </div>
                    <Icon size={22} />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-current" style={{ width: `${rate}%` }} />
                  </div>
                  <p className="mt-2 flex items-center justify-between text-xs font-bold">
                    <span>{rate}% clocked in · {group.pending || 0} pending</span>
                    <ChevronRight size={14} className="opacity-60" />
                  </p>
                </article>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => openModal({ type: 'allStaff' })}
            className="mt-5 flex w-full items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-100"
          >
            <Clock3 size={17} className="text-brand-purple" />
            <span><strong className="text-slate-900">{staff.clockedIn || 0}</strong> of <strong className="text-slate-900">{staff.total || 0}</strong> active staff have clocked in today.</span>
            <ChevronRight size={14} className="ml-auto text-slate-400" />
          </button>
        </section>

        {/* ── Student registers ────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-brand-purple">Student attendance registers</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Register completion</h2>
              <p className="mt-1 text-sm text-slate-500">A register counts as complete only when every actively enrolled learner in that class has been marked.</p>
            </div>
            <button
              type="button"
              onClick={() => openModal({ type: 'classes', filter: null, title: 'All class registers' })}
              className="rounded-xl bg-emerald-50 px-4 py-3 text-right transition hover:bg-emerald-100"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Learner coverage</p>
              <p className="text-2xl font-black text-emerald-800">{coverage}%</p>
              <p className="text-xs text-emerald-700">{registers.learnersMarked || 0} of {registers.learnersExpected || 0} marked</p>
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => openModal({ type: 'classes', filter: 'COMPLETE', title: 'Complete registers' })}
              className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100"
            >
              <p className="text-xs font-black uppercase text-emerald-700">Complete</p>
              <p className="mt-1 text-3xl font-black text-emerald-900">{registers.complete || 0}</p>
              <p className="text-xs text-emerald-700">classes fully marked</p>
            </button>
            <button
              type="button"
              onClick={() => openModal({ type: 'classes', filter: 'IN_PROGRESS', title: 'Registers in progress' })}
              className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-left transition hover:bg-amber-100"
            >
              <p className="text-xs font-black uppercase text-amber-700">In progress</p>
              <p className="mt-1 text-3xl font-black text-amber-900">{registers.inProgress || 0}</p>
              <p className="text-xs text-amber-700">classes partly marked</p>
            </button>
            <button
              type="button"
              onClick={() => openModal({ type: 'classes', filter: 'NOT_STARTED', title: 'Registers not started' })}
              className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-left transition hover:bg-rose-100"
            >
              <p className="text-xs font-black uppercase text-rose-700">Not started</p>
              <p className="mt-1 text-3xl font-black text-rose-900">{registers.notStarted || 0}</p>
              <p className="text-xs text-rose-700">classes needing attention</p>
            </button>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
              <span>Class</span><span>Marked</span><span>Presence</span><span>Status</span>
            </div>
            {classes.map((item) => (
              <div
                key={item.classId}
                role="button"
                tabIndex={0}
                onClick={() => openModal({ type: 'classDetail', classId: item.classId, className: item.className })}
                onKeyDown={(e) => { if (e.key === 'Enter') openModal({ type: 'classDetail', classId: item.classId, className: item.className }); }}
                className="grid cursor-pointer grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm transition hover:bg-slate-50"
              >
                <span className="font-bold text-slate-800">{item.className}{item.teacherName ? <span className="ml-2 font-medium text-slate-400">· {item.teacherName}</span> : null}</span>
                <span className="text-slate-600">{item.marked}/{item.expected}</span>
                <span className="text-slate-600">{item.present} present</span>
                <Badge style={REGISTER_STATUS_STYLES[item.status]}>{item.status.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Staff group / all-staff modal ──────────────────────────────────── */}
      {(modal?.type === 'staffGroup' || modal?.type === 'allStaff') && (
        <ReportModal
          title={modal.type === 'staffGroup' ? modal.label : 'All active staff'}
          subtitle={`${filteredStaffMembers.length} ${filteredStaffMembers.length === 1 ? 'person' : 'people'}`}
          onClose={closeModal}
          search={modalSearch}
          onSearchChange={setModalSearch}
          onExport={() => downloadCsv(
            `staff-attendance-${modal.type === 'staffGroup' ? modal.key : 'all'}.csv`,
            filteredStaffMembers.map((m) => ({
              Name: m.name, 'Staff ID': m.staffId || '', Role: m.roleLabel,
              ...(modal.type === 'allStaff' ? { Group: m.groupLabel } : {}),
              Status: m.status.replace('_', ' '), 'Clock in': formatTime(m.clockInAt), 'Clock out': formatTime(m.clockOutAt),
            }))
          )}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left">Role</th>
                {modal.type === 'allStaff' && <th className="px-3 py-2.5 text-left">Group</th>}
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Clock in</th>
                <th className="px-6 py-2.5 text-left">Clock out</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffMembers.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">No staff match your search.</td></tr>
              )}
              {filteredStaffMembers.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-6 py-2.5 font-bold text-slate-800">{member.name}{member.staffId ? <span className="ml-1.5 font-medium text-slate-400">#{member.staffId}</span> : null}</td>
                  <td className="px-3 py-2.5 text-slate-600">{member.roleLabel}</td>
                  {modal.type === 'allStaff' && <td className="px-3 py-2.5 text-slate-600">{member.groupLabel}</td>}
                  <td className="px-3 py-2.5"><Badge style={STAFF_STATUS_STYLES[member.status]}>{member.status.replace('_', ' ')}</Badge></td>
                  <td className="px-3 py-2.5 text-slate-600">{formatTime(member.clockInAt)}</td>
                  <td className="px-6 py-2.5 text-slate-600">{formatTime(member.clockOutAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportModal>
      )}

      {/* ── Class registers modal ──────────────────────────────────────────── */}
      {modal?.type === 'classes' && (
        <ReportModal
          title={modal.title}
          subtitle={`${filteredClasses.length} of ${classes.length} classes`}
          onClose={closeModal}
          search={modalSearch}
          onSearchChange={setModalSearch}
          onExport={() => downloadCsv(
            'class-registers.csv',
            filteredClasses.map((item) => ({
              Class: item.className, Teacher: item.teacherName || '', Room: item.room || '',
              Expected: item.expected, Marked: item.marked, Present: item.present, Late: item.late, Absent: item.absent,
              Status: item.status.replace('_', ' '),
            }))
          )}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2.5 text-left">Class</th>
                <th className="px-3 py-2.5 text-left">Marked</th>
                <th className="px-3 py-2.5 text-left">Present</th>
                <th className="px-3 py-2.5 text-left">Late</th>
                <th className="px-3 py-2.5 text-left">Absent</th>
                <th className="px-6 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">No classes match your search.</td></tr>
              )}
              {filteredClasses.map((item) => (
              <tr
              key={item.classId}
              onClick={() => openModal({ type: 'classDetail', classId: item.classId, className: item.className }, { type: 'classes', filter: modal.filter, title: modal.title })}
              className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
              >
                  <td className="px-6 py-2.5 font-bold text-slate-800">{item.className}{item.teacherName ? <span className="ml-1.5 font-medium text-slate-400">· {item.teacherName}</span> : null}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.marked}/{item.expected}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.present}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.late}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.absent}</td>
                  <td className="px-6 py-2.5"><Badge style={REGISTER_STATUS_STYLES[item.status]}>{item.status.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportModal>
      )}

      {/* ── Learner-level class register modal ─────────────────────────────── */}
      {modal?.type === 'classDetail' && (
        <ReportModal
          title={modal.className}
          subtitle={classDetail.data ? `${classDetail.data.marked} of ${classDetail.data.totalLearners} learners marked today` : undefined}
          onClose={closeModal}
          onBack={modal.back ? goBack : undefined}
          search={classDetail.data ? modalSearch : undefined}
          onSearchChange={classDetail.data ? setModalSearch : undefined}
          onExport={classDetail.data ? () => downloadCsv(
            `${modal.className.replace(/\s+/g, '-').toLowerCase()}-register.csv`,
            filteredLearners.map((l) => ({
              'Admission No': l.admissionNumber || '', Name: `${l.firstName} ${l.lastName}`.trim(),
              Gender: l.gender || '', Status: l.attendance ? l.attendance.status : 'NOT MARKED',
              Remarks: l.attendance?.remarks || '',
            }))
          ) : undefined}
        >
          {classDetail.loading && (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Loading register…
            </div>
          )}
          {!classDetail.loading && classDetail.error && (
            <p className="px-6 py-8 text-center text-sm text-rose-600">{classDetail.error}</p>
          )}
          {!classDetail.loading && !classDetail.error && classDetail.data && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-2.5 text-left">Admission #</th>
                  <th className="px-3 py-2.5 text-left">Name</th>
                  <th className="px-3 py-2.5 text-left">Gender</th>
                  <th className="px-6 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLearners.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">No learners match your search.</td></tr>
                )}
                {filteredLearners.map((learner) => {
                  const status = learner.attendance ? learner.attendance.status : 'NOT_MARKED';
                  return (
                    <tr key={learner.id} className="border-t border-slate-100">
                      <td className="px-6 py-2.5 text-slate-500">{learner.admissionNumber || '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{learner.firstName} {learner.lastName}</td>
                      <td className="px-3 py-2.5 text-slate-600">{learner.gender || '—'}</td>
                      <td className="px-6 py-2.5"><Badge style={LEARNER_STATUS_STYLES[status]}>{status.replace('_', ' ')}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ReportModal>
      )}
    </main>
  );
};

export default OperationsInsightsPage;
