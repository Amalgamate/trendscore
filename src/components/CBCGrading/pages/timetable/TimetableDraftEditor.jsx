import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, ClipboardCheck, Download, FileSpreadsheet, Filter, GitBranch, Loader2, Lock, Maximize2, Minimize2, Printer, Redo2, RefreshCw, RotateCcw, Search, Send, Sparkles, Undo2, Unlock, Upload, UserCheck, UserX, Users, Wrench, X, Zap } from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { getSchoolBranding } from '../../../../utils/brandingUtils';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Publish confirmation dialog ───────────────────────────────────────────────
const PublishConfirmDialog = ({ plan, version, entryCount, overrideCount, onConfirm, onCancel, publishing }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <Upload size={22} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-base">Publish timetable?</h3>
          <p className="text-sm text-gray-500 mt-1">
            This will make <span className="font-semibold text-gray-700">{plan.name} — Version {version.version}</span> the
            live schedule for {entryCount} lesson period{entryCount !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">Before you publish:</p>
        <ul className="list-disc list-inside space-y-0.5 font-normal">
          <li>All existing class schedules for this term will be replaced.</li>
          {overrideCount > 0 && (
            <li className="font-semibold text-amber-900">
              {overrideCount} manual override{overrideCount !== 1 ? 's' : ''} will be replaced by the engine schedule.
            </li>
          )}
          <li>Any previous published version will be archived.</li>
          <li>Teacher, student, and dashboard views will update immediately.</li>
        </ul>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={publishing}
          className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={publishing}
          className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-40"
        >
          {publishing ? <><Loader2 size={15} className="animate-spin" /> Publishing…</> : <><Upload size={15} /> Yes, publish</>}
        </button>
      </div>
    </div>
  </div>
);

// ── Destructive-action confirmation dialog (replaces window.confirm) ──────
 const DangerConfirmDialog = ({ title, message, confirmLabel = 'Confirm', busy, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
          <AlertTriangle size={22} className="text-rose-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{message}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-10 px-5 rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-rose-700 disabled:opacity-40"
        >
          {busy ? <><Loader2 size={15} className="animate-spin" /> Working…</> : <><RotateCcw size={15} /> {confirmLabel}</>}
        </button>
      </div>
    </div>
  </div>
 );

// ── Timetable Coverage & Gap Review Modal ─────────────────────────────────────
const CoverageReportModal = ({ version, plan, onClose }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'gaps', 'covered'
  const [search, setSearch] = useState('');

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.timetable.getGapAnalysis(version.id);
      setReport(res.data || res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [version.id]);

  const summary = report?.summary || {
    totalActiveClasses: 0,
    fullyScheduled: 0,
    partiallyScheduled: 0,
    unscheduled: 0,
    overallCoveragePct: 0,
    totalRequired: 0,
    totalScheduled: 0,
  };

  const filteredClasses = useMemo(() => {
    if (!report?.classes) return [];
    return report.classes.filter(cls => {
      const matchesSearch = !search ||
        cls.className?.toLowerCase().includes(search.toLowerCase()) ||
        cls.grade?.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === 'gaps') return cls.coveragePct < 100;
      if (filter === 'covered') return cls.coveragePct >= 100;
      return true;
    });
  }, [report?.classes, filter, search]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-violet-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">Timetable Self-Review & Coverage Report</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {plan.name} · v{version.version} · Active classes vs. scheduled periods
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={28} />
            </div>
          ) : !report ? (
            <div className="text-center py-12 text-sm text-gray-500">
              Could not load coverage data.
            </div>
          ) : (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Overall Coverage</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    summary.overallCoveragePct >= 90 ? 'text-emerald-600' :
                    summary.overallCoveragePct >= 60 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {summary.overallCoveragePct}%
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {summary.totalScheduled} of {summary.totalRequired} periods
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Fully Filled</p>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">{summary.fullyScheduled}</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">classes 100% covered</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Partially Filled</p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">{summary.partiallyScheduled}</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">classes with gaps</p>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Unscheduled</p>
                  <p className="text-2xl font-bold text-rose-800 mt-1">{summary.unscheduled}</p>
                  <p className="text-[11px] text-rose-600 mt-0.5">active classes with 0 periods</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">Weekly Period Fulfillment</span>
                  <span className="font-bold text-gray-900">{summary.totalScheduled} / {summary.totalRequired} slots filled</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      summary.overallCoveragePct >= 90 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                      summary.overallCoveragePct >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                      'bg-gradient-to-r from-rose-500 to-orange-500'
                    }`}
                    style={{ width: `${Math.min(summary.overallCoveragePct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Notice if gaps exist */}
              {(summary.partiallyScheduled > 0 || summary.unscheduled > 0) && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unfilled lesson spaces detected</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      {summary.unscheduled > 0 && `${summary.unscheduled} active class${summary.unscheduled > 1 ? 'es have' : ' has'} no timetable entries at all. `}
                      {summary.partiallyScheduled > 0 && `${summary.partiallyScheduled} class${summary.partiallyScheduled > 1 ? 'es are' : ' is'} missing required instructional periods. `}
                      Review subject allocations below to ensure complete curriculum coverage.
                    </p>
                  </div>
                </div>
              )}

              {/* Controls: Filter & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All ({report.classes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('gaps')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filter === 'gaps' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Needs Attention ({summary.partiallyScheduled + summary.unscheduled})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('covered')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filter === 'covered' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Complete ({summary.fullyScheduled})
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search class or grade…"
                    className="h-8 pl-3 pr-3 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                  />
                </div>
              </div>

              {/* Classes Breakdown List */}
              <div className="space-y-3">
                {filteredClasses.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
                    No classes match the filter criteria.
                  </div>
                ) : (
                  filteredClasses.map(cls => {
                    const isFull = cls.coveragePct >= 100;
                    const isZero = cls.totalScheduled === 0;
                    return (
                      <div
                        key={cls.classId}
                        className={`rounded-xl border p-4 transition-all ${
                          isFull
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : isZero
                            ? 'border-rose-200 bg-rose-50/40'
                            : 'border-amber-200 bg-amber-50/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-900 text-sm">{cls.className}</h4>
                              <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                                {cls.grade}
                              </span>
                              {cls.stream && (
                                <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                                  Stream {cls.stream}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {cls.totalScheduled} of {cls.totalRequired} periods scheduled
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                              isFull ? 'bg-emerald-100 text-emerald-800' :
                              isZero ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {cls.coveragePct}% {isFull ? 'Filled' : isZero ? 'Unscheduled' : 'Partial'}
                            </span>
                          </div>
                        </div>

                        {/* Progress line */}
                        <div className="mt-2.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isFull ? 'bg-emerald-500' : isZero ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(cls.coveragePct, 100)}%` }}
                          />
                        </div>

                        {/* Gaps listing */}
                        {cls.subjectGaps && cls.subjectGaps.length > 0 ? (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                              Unfilled Subject Allocations:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {cls.subjectGaps.map(g => (
                                <span
                                  key={g.learningAreaId}
                                  className="text-[10px] rounded-lg bg-white border border-amber-300 text-amber-900 px-2 py-1 flex items-center gap-1 shadow-2xs font-medium"
                                >
                                  <span>{g.learningAreaName}:</span>
                                  <span className="font-bold">{g.scheduled}/{g.required}</span>
                                  <span className="text-rose-600 font-bold">(-{g.gap})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : isFull ? (
                          <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={12} /> All subject allocations fully scheduled.
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh review
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Lesson Quick Fix / Edit Modal ─────────────────────────────────────────────
const LessonQuickFixModal = ({
  entry,
  onClose,
  entries = [],
  teachers = [],
  rooms = [],
  periods = [],
  availabilityRules = [],
  conflict = null,
  onSave,
  onNavigateToAvailability,
  canEdit = true
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState(entry.teacherId || '');
  const [selectedRoomId, setSelectedRoomId] = useState(entry.roomId || '');
  const [selectedDay, setSelectedDay] = useState(entry.day);
  const [selectedPeriodId, setSelectedPeriodId] = useState(entry.bellPeriodId || '');
  const [locked, setLocked] = useState(Boolean(entry.locked));
  const [saving, setSaving] = useState(false);

  // Instructional periods only
  const lessonPeriods = useMemo(
    () => periods.filter(p => p.instructional !== false && p.type !== 'BREAK' && p.type !== 'LUNCH'),
    [periods]
  );

  const currentPeriod = lessonPeriods.find(p => p.id === selectedPeriodId || (p.startTime === entry.startTime && p.endTime === entry.endTime)) || lessonPeriods[0];

  // Check teacher availability and busyness for current day & period
  const teacherOptions = useMemo(() => {
    return teachers.map(t => {
      const isCurrent = t.id === selectedTeacherId;
      const busyLesson = entries.find(e =>
        e.id !== entry.id &&
        e.teacherId === t.id &&
        e.day === selectedDay &&
        currentPeriod &&
        e.startTime === currentPeriod.startTime
      );
      const unavailRule = availabilityRules.find(r =>
        r.teacherId === t.id &&
        r.day === selectedDay &&
        !r.available
      );

      let status = 'free';
      let statusLabel = 'Available';
      if (busyLesson) {
        status = 'busy';
        statusLabel = `Busy with ${busyLesson.class?.name || 'another class'}`;
      } else if (unavailRule) {
        status = 'unavailable';
        statusLabel = 'Marked unavailable';
      }

      return {
        ...t,
        status,
        statusLabel,
        isCurrent
      };
    }).sort((a, b) => {
      if (a.status === 'free' && b.status !== 'free') return -1;
      if (a.status !== 'free' && b.status === 'free') return 1;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [teachers, entries, entry.id, selectedDay, currentPeriod, selectedTeacherId, availabilityRules]);

  // Compute free slots for this class and current teacher
  const suggestedSlots = useMemo(() => {
    const suggestions = [];
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      for (const p of lessonPeriods) {
        if (d === entry.day && p.startTime === entry.startTime) continue;
        const classOccupied = entries.some(e => e.id !== entry.id && e.classId === entry.classId && e.day === d && e.startTime === p.startTime);
        if (classOccupied) continue;

        const teacherOccupied = selectedTeacherId && entries.some(e => e.id !== entry.id && e.teacherId === selectedTeacherId && e.day === d && e.startTime === p.startTime);
        const teacherUnavail = selectedTeacherId && availabilityRules.some(r => r.teacherId === selectedTeacherId && r.day === d && !r.available);

        if (!teacherOccupied && !teacherUnavail) {
          suggestions.push({ day: d, period: p, label: `${d} · ${p.name} (${p.startTime}–${p.endTime})`, tone: 'perfect' });
        } else if (!classOccupied) {
          suggestions.push({ day: d, period: p, label: `${d} · ${p.name} (${p.startTime}–${p.endTime})`, tone: 'class_free_only' });
        }
      }
    }
    return suggestions.slice(0, 4);
  }, [lessonPeriods, entries, entry, selectedTeacherId, availabilityRules]);

  const handleApply = async (e) => {
    e?.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const periodObj = lessonPeriods.find(p => p.id === selectedPeriodId) || currentPeriod;
      const updates = {
        teacherId: selectedTeacherId || null,
        roomId: selectedRoomId || null,
        day: selectedDay,
        bellPeriodId: periodObj?.id || entry.bellPeriodId,
        startTime: periodObj?.startTime || entry.startTime,
        endTime: periodObj?.endTime || entry.endTime,
        locked
      };
      await onSave(entry.id, updates);
      onClose();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${conflict ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {conflict ? <AlertTriangle size={20} /> : <Wrench size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">
                {conflict ? 'Quick Fix Lesson Conflict' : 'Inspect & Edit Lesson'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {entry.learningArea?.name || entry.learningArea?.shortName || 'Lesson'} · {entry.class?.name} · {entry.day} ({entry.startTime}–{entry.endTime})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleApply} className="p-6 overflow-y-auto space-y-5">
          {/* Conflict Banner if present */}
          {conflict && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>{conflict.code?.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-rose-800 leading-relaxed font-medium">
                {conflict.message}
              </p>
              {conflict.code === 'TEACHER_UNAVAILABLE' && onNavigateToAvailability && (
                <div className="pt-2 border-t border-rose-200/70 flex items-center justify-between gap-3">
                  <span className="text-rose-700 text-[11px]">Teacher availability rule is currently blocking this slot.</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToAvailability({ teacherId: entry.teacherId, day: entry.day });
                    }}
                    className="h-7 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] flex items-center gap-1 shrink-0 shadow-2xs"
                  >
                    <UserX size={12} /> Fix in Availability Tab
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Slot Suggestions */}
          {suggestedSlots.length > 0 && canEdit && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1.5 flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-600" />
                1-Click Free Slot Recommendations (Class & Teacher Free)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDay(slot.day);
                      setSelectedPeriodId(slot.period.id);
                    }}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                      selectedDay === slot.day && (selectedPeriodId === slot.period.id || currentPeriod?.startTime === slot.period.startTime)
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-200 font-semibold'
                        : 'bg-white border-gray-200 hover:border-indigo-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{slot.day}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">✓ Open Slot</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{slot.period.name} ({slot.period.startTime}–{slot.period.endTime})</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Day selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Day of Week</label>
              <select
                disabled={!canEdit}
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Period selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Bell Period</label>
              <select
                disabled={!canEdit}
                value={selectedPeriodId || currentPeriod?.id || ''}
                onChange={e => setSelectedPeriodId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {lessonPeriods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.startTime}–{p.endTime})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {/* Teacher selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center justify-between">
                <span>Assigned Teacher</span>
                <span className="text-[10px] font-normal text-gray-400">Live conflict check</span>
              </label>
              <select
                disabled={!canEdit}
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">-- No teacher assigned --</option>
                {teacherOptions.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} {t.status === 'free' ? '  ✓ (Free)' : `  ⚠ (${t.statusLabel})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Room selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Assigned Room</label>
              <select
                disabled={!canEdit}
                value={selectedRoomId}
                onChange={e => setSelectedRoomId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">-- No specific room --</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.code ? `(${r.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Locked checkbox */}
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={locked}
                  onChange={e => setLocked(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="flex items-center gap-1.5">
                  {locked ? <Lock size={13} className="text-amber-600" /> : <Unlock size={13} className="text-gray-400" />}
                  Lock this lesson in place (prevents automatic rescheduling)
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-40"
              >
                {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={14} /> Apply Fix & Re-validate</>}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Conflict Resolution Assistant Modal ───────────────────────────────────────
const ConflictAssistantModal = ({
  open,
  onClose,
  conflicts = [],
  entries = [],
  teachers = [],
  onLocateEntry,
  onQuickFixEntry,
  onNavigateToAvailability
}) => {
  const [filterCode, setFilterCode] = useState('ALL');

  if (!open) return null;

  const hardConflicts = conflicts.filter(c => c.severity === 'ERROR');

  const filtered = filterCode === 'ALL'
    ? conflicts
    : conflicts.filter(c => c.code === filterCode);

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-rose-50/80 via-white to-amber-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base leading-tight">
                  Timetable Intelligence & Conflict Resolver
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  {conflicts.length} issue{conflicts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Click any conflict to locate it on the grid or apply an intelligent 1-click resolution.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        {/* Conflict Filter Pills */}
        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[10px] font-bold uppercase text-gray-400 mr-1">Filter:</span>
          {['ALL', 'TEACHER_UNAVAILABLE', 'TEACHER_CLASH', 'ROOM_CLASH', 'CLASS_CLASH'].map(code => {
            const count = code === 'ALL' ? conflicts.length : conflicts.filter(c => c.code === code).length;
            if (code !== 'ALL' && count === 0) return null;
            return (
              <button
                key={code}
                onClick={() => setFilterCode(code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterCode === code
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {code === 'ALL' ? 'All Issues' : code.replace(/_/g, ' ')} ({count})
              </button>
            );
          })}
        </div>

        {/* Conflict List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
              <p className="font-semibold text-gray-800">No conflicts found in this filter.</p>
              <p className="text-xs text-gray-400">Your timetable is compliant and ready for publication.</p>
            </div>
          ) : (
            filtered.map((conflict, idx) => {
              const matchedEntries = entries.filter(e => conflict.entryIds?.includes(e.id));
              const isHard = conflict.severity === 'ERROR';

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 transition-all ${
                    isHard
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                        isHard ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {conflict.code?.replace(/_/g, ' ') || 'Conflict'}
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {conflict.message}
                      </span>
                    </div>
                  </div>

                  {/* Conflicting Lessons Card */}
                  <div className="space-y-2 my-3">
                    {matchedEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs">
                              {entry.learningArea?.name || entry.learningArea?.shortName || 'Lesson'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                              {entry.class?.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-3">
                            <span>📅 {entry.day} ({entry.startTime}–{entry.endTime})</span>
                            <span>👤 {entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'Unassigned'}</span>
                            {entry.room?.name && <span>📍 {entry.room.name}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLocateEntry(entry.id)}
                            className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center gap-1 shadow-2xs"
                            title="Highlight and scroll to this lesson in the timetable"
                          >
                            <Search size={13} className="text-indigo-600" />
                            Locate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onQuickFixEntry(entry, conflict);
                            }}
                            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs"
                            title="Reassign teacher, room, or pick a free period"
                          >
                            <Wrench size={13} />
                            Fix Lesson
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Special Shortcut for TEACHER_UNAVAILABLE */}
                  {conflict.code === 'TEACHER_UNAVAILABLE' && matchedEntries[0]?.teacherId && (
                    <div className="mt-2 pt-2 border-t border-rose-200 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-rose-700 font-medium">
                        Teacher availability rule is currently active for this day.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToAvailability?.({
                            teacherId: matchedEntries[0].teacherId,
                            day: matchedEntries[0].day
                          });
                        }}
                        className="h-7 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-2xs"
                      >
                        <UserX size={12} />
                        Fix in Availability Tab
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {hardConflicts.length > 0
              ? `⚠️ ${hardConflicts.length} hard conflict(s) must be resolved before publishing.`
              : '✓ All critical conflicts resolved.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const TimetableDraftEditor = ({
  plan,
  version: initialVersion,
  bellSchedule,
  teachers = [],
  rooms = [],
  classes = [],
  availabilityRules = [],
  onBack,
  onChanged,
  onNavigateSection,
  canEdit = false,
  isFullScreen = false,
  onToggleFullScreen
}) => {
  const { showError, showSuccess } = useNotifications();
  const [version, setVersion] = useState(initialVersion);
  const [entries, setEntries] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [analytics, setAnalytics] = useState({ teachers: [], classes: [], rooms: [] });
  const [action, setAction] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [overrideCount, setOverrideCount] = useState(0);
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { title, message, confirmLabel, onConfirm }

  // Intelligence & Filter States
  const [showConflictAssistant, setShowConflictAssistant] = useState(false);
  const [selectedEntryForFix, setSelectedEntryForFix] = useState(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState(null);
  const [classFilter, setClassFilter] = useState('ALL');
  const [teacherFilter, setTeacherFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyConflictsFilter, setOnlyConflictsFilter] = useState(false);

  // Include ALL active periods (breaks + instructional) sorted by sequence
  const periods = useMemo(
    () => (bellSchedule?.periods || []).filter(item => item.active).sort((a, b) => a.sequence - b.sequence),
    [bellSchedule]
  );
  const conflictedIds = useMemo(() => new Set(conflicts.flatMap(item => item.entryIds)), [conflicts]);
  const hardConflicts = useMemo(() => conflicts.filter(item => item.severity === 'ERROR'), [conflicts]);

  // Derive list of classes, teachers, rooms from props with fallback to entries
  const availableClasses = useMemo(() => {
    if (classes && classes.length > 0) return classes;
    const map = new Map();
    entries.forEach(e => {
      if (e.class?.id) map.set(e.class.id, e.class);
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [classes, entries]);

  const availableTeachers = useMemo(() => {
    if (teachers && teachers.length > 0) return teachers;
    const map = new Map();
    entries.forEach(e => {
      if (e.teacher?.id) map.set(e.teacher.id, e.teacher);
    });
    return Array.from(map.values()).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [teachers, entries]);

  const availableRooms = useMemo(() => {
    if (rooms && rooms.length > 0) return rooms;
    const map = new Map();
    entries.forEach(e => {
      if (e.room?.id) map.set(e.room.id, e.room);
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rooms, entries]);

  // Filtered entries according to active class/teacher/conflict/search filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (classFilter !== 'ALL' && entry.classId !== classFilter) return false;
      if (teacherFilter !== 'ALL' && entry.teacherId !== teacherFilter) return false;
      if (onlyConflictsFilter && !conflictedIds.has(entry.id)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subject = (entry.learningArea?.name || entry.learningArea?.shortName || '').toLowerCase();
        const cls = (entry.class?.name || '').toLowerCase();
        const teacher = (entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : '').toLowerCase();
        const room = (entry.room?.name || '').toLowerCase();
        if (!subject.includes(q) && !cls.includes(q) && !teacher.includes(q) && !room.includes(q)) return false;
      }
      return true;
    });
  }, [entries, classFilter, teacherFilter, onlyConflictsFilter, searchQuery, conflictedIds]);

  const activeTeacherObj = useMemo(
    () => (teacherFilter !== 'ALL' ? availableTeachers.find(t => t.id === teacherFilter) : null),
    [teacherFilter, availableTeachers]
  );

  const locateEntryInGrid = (entryId) => {
    const target = entries.find(e => e.id === entryId);
    if (!target) return;
    if (classFilter !== 'ALL' && classFilter !== target.classId) setClassFilter('ALL');
    if (teacherFilter !== 'ALL' && teacherFilter !== target.teacherId) setTeacherFilter('ALL');
    setHighlightedEntryId(entryId);
    setShowConflictAssistant(false);

    setTimeout(() => {
      const el = document.getElementById(`entry-card-${entryId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedEntryId(id => (id === entryId ? null : id));
    }, 4000);
  };

  const isReadOnly = ['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(version.status);
  const canPublish = canEdit && version.status === 'APPROVED' && hardConflicts.length === 0;

  const load = async () => {
    setLoading(true);
    try {
      const [entryResponse, conflictResponse, analyticsResponse] = await Promise.all([
        api.timetable.getEntries(version.id),
        api.timetable.getConflicts(version.id),
        api.timetable.getAnalytics(version.id),
      ]);
      setEntries(entryResponse.data || entryResponse || []);
      setConflicts(conflictResponse.data || conflictResponse || []);
      setAnalytics(analyticsResponse.data || analyticsResponse || { teachers: [], classes: [], rooms: [] });

      // Fetch override count so the publish dialog can inform the admin
      if (version.status === 'APPROVED') {
        try {
          const overridesResp = await api.timetable.getOverrideCount(version.id);
          setOverrideCount((overridesResp.data ?? overridesResp)?.overrideCount ?? 0);
        } catch {
          setOverrideCount(0);
        }
      }
    } catch (error) {
      showError(error.message || 'Failed to open timetable draft');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [version.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshConflicts = async () => {
    const response = await api.timetable.getConflicts(version.id);
    setConflicts(response.data || response || []);
  };

  const applyChange = async (entryId, changes, record = true) => {
    const current = entries.find(item => item.id === entryId);
    if (!current) return;
    const previous = Object.fromEntries(Object.keys(changes).map(key => [key, current[key]]));
    setSavingId(entryId);
    setEntries(items => items.map(item => item.id === entryId ? { ...item, ...changes } : item));
    try {
      const response = await api.timetable.updateEntry(version.id, entryId, changes);
      const updated = response.data || response;
      setEntries(items => items.map(item => item.id === entryId ? updated : item));
      if (record) {
        setHistory(items => [...items.slice(-49), { entryId, before: previous, after: changes }]);
        setFuture([]);
      }
      await refreshConflicts();
    } catch (error) {
      setEntries(items => items.map(item => item.id === entryId ? current : item));
      showError(error.message || 'Could not update lesson');
      throw error;
    } finally {
      setSavingId('');
    }
  };

  const move = async (event, day, period) => {
    event.preventDefault();
    const entryId = event.dataTransfer.getData('text/timetable-entry');
    const entry = entries.find(item => item.id === entryId);
    if (!canEdit || !entry || entry.locked) return;
    if (entries.some(item => item.id !== entryId && item.classId === entry.classId && item.day === day && item.startTime === period.startTime)) {
      showError('That class already has a lesson in this period.');
      return;
    }
    await applyChange(entryId, { day, bellPeriodId: period.id, startTime: period.startTime, endTime: period.endTime });
  };

  const undo = async () => {
    const act = history.at(-1);
    if (!act) return;
    try {
      await applyChange(act.entryId, act.before, false);
      setHistory(items => items.slice(0, -1));
      setFuture(items => [...items, act]);
    } catch { /* API rollback already restored the UI. */ }
  };

  const redo = async () => {
    const act = future.at(-1);
    if (!act) return;
    try {
      await applyChange(act.entryId, act.after, false);
      setFuture(items => items.slice(0, -1));
      setHistory(items => [...items, act]);
    } catch { /* API rollback already restored the UI. */ }
  };

  // Approval workflow — maps current status to the next reviewable status
  const nextStatus = {
    DRAFT: 'DEPARTMENT_REVIEW',
    GENERATED: 'DEPARTMENT_REVIEW',
    DEPARTMENT_REVIEW: 'DEPUTY_REVIEW',
    DEPUTY_REVIEW: 'PRINCIPAL_REVIEW',
    PRINCIPAL_REVIEW: 'APPROVED',
  }[version.status];

  const advance = async () => {
    if (!nextStatus) return;
    setAction('review');
    try {
      await api.timetable.transition(version.id, nextStatus);
      showSuccess(`Moved to ${nextStatus.replaceAll('_', ' ').toLowerCase()}`);
      await onChanged?.();
      onBack();
    } catch (error) {
      showError(error.message || 'Review transition failed');
    } finally {
      setAction('');
    }
  };

  const clone = async () => {
    setAction('clone');
    try {
      await api.timetable.cloneVersion(version.id);
      showSuccess('A new editable version was created');
      await onChanged?.();
      onBack();
    } catch (error) {
      showError(error.message || 'Could not restore this version');
    } finally {
      setAction('');
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.timetable.publish(version.id);
      setVersion(v => ({ ...v, status: 'PUBLISHED' }));
      showSuccess(`${plan.name} v${version.version} is now live — class schedules updated.`);
      setShowPublishDialog(false);
      await onChanged?.();
    } catch (error) {
      showError(error.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const performResetDraft = async () => {
    setAction('reset');
    try {
      await api.timetable.resetVersion(version.id, true);
      showSuccess('Draft timetable reset to blank.');
      setVersion(v => ({ ...v, status: 'DRAFT' }));
      setHistory([]);
      setFuture([]);
      await load();
      await onChanged?.();
    } catch (error) {
      showError(error.message || 'Could not reset draft');
    } finally {
      setAction('');
      setConfirmAction(null);
    }
  };

  const handleResetDraft = () => {
    setConfirmAction({
      title: 'Reset this draft?',
      message: `All ${entries.length} lesson period${entries.length !== 1 ? 's' : ''} will be cleared from version ${version.version}, returning it to an empty grid. This cannot be undone.`,
      confirmLabel: 'Reset draft',
      onConfirm: performResetDraft
    });
  };

  const performResetLive = async () => {
    setAction('resetLive');
    try {
      await api.timetable.resetLiveSchedule(plan.academicYear, plan.term);
      showSuccess('Live timetable unpublished and reset.');
      setVersion(v => ({ ...v, status: 'ARCHIVED' }));
      await onChanged?.();
      onBack();
    } catch (error) {
      showError(error.message || 'Could not reset live schedule');
    } finally {
      setAction('');
      setConfirmAction(null);
    }
  };

  const handleResetLive = () => {
    setConfirmAction({
      title: 'Reset the live timetable?',
      message: `All published class schedule records for ${plan.name} (${plan.academicYear} ${plan.term.replace('_', ' ')}) will be removed from the school matrix. Teachers and students will immediately lose their published schedule for this term.`,
      confirmLabel: 'Reset live schedule',
      onConfirm: performResetLive
    });
  };

  const exportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Master Timetable');
    sheet.columns = [
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Start', key: 'startTime', width: 10 },
      { header: 'End', key: 'endTime', width: 10 },
      { header: 'Class', key: 'className', width: 22 },
      { header: 'Learning Area', key: 'area', width: 24 },
      { header: 'Teacher', key: 'teacher', width: 24 },
      { header: 'Room', key: 'room', width: 18 },
    ];
    entries.forEach(entry => sheet.addRow({
      ...entry,
      className: entry.class?.name,
      area: entry.learningArea?.name,
      teacher: entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : '',
      room: entry.room?.name || '',
    }));
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.name.replace(/[^a-z0-9]+/gi, '_')}_v${version.version}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async (targetTeacher = null) => {
    // Determine if we are generating a personal teacher timetable or master school timetable
    const activeTeacher = (targetTeacher && targetTeacher.id) ? targetTeacher : (teacherFilter !== 'ALL' ? availableTeachers.find(t => t.id === teacherFilter) : null);
    const isTeacherPersonal = Boolean(activeTeacher);

    // School Branding and Logo Resolution
    const branding = getSchoolBranding();
    const rawLogo = branding.logo || '/branding/logo.png';
    const absoluteLogoUrl = (rawLogo.startsWith('http://') || rawLogo.startsWith('https://') || rawLogo.startsWith('data:'))
      ? rawLogo
      : `${window.location.origin}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`;
    const schoolName = branding.name || 'KENYA CBE SCHOOL';
    const schoolMotto = branding.motto || 'Excellence in Competency Based Curriculum';
    const contactParts = [branding.address, branding.phone, branding.email].filter(Boolean);
    const brandColor = branding.brandColor || '#1e1b4b';

    const planTitle   = plan?.name || 'Timetable';
    const versionStr  = `Version ${version?.version || 1}`;
    const termStr     = (version?.plan?.term || plan?.term || '').replace('_', ' ');
    const yearStr     = version?.plan?.academicYear || plan?.academicYear || '';
    const generatedOn = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Filter entries: personal teacher only vs all classes
    const relevantEntries = isTeacherPersonal
      ? entries.filter(e => e.teacherId === activeTeacher.id)
      : entries;

    // Group entries for fast lookup: day -> startTime -> entry[]
    const lookup = {};
    relevantEntries.forEach(e => {
      const key = `${e.day}::${e.startTime}`;
      if (!lookup[key]) lookup[key] = [];
      lookup[key].push(e);
    });

    const dayHeaders = days.map(d => `<th style="padding:10px 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;background:${brandColor};color:#fff;border:1px solid #312e81;">${d}</th>`).join('');

    // Teacher Personal Metrics
    const teacherLessonsCount = relevantEntries.length;
    const teacherTeachingDays = new Set(relevantEntries.map(e => e.day)).size;
    const teacherClasses = [...new Set(relevantEntries.map(e => e.class?.name).filter(Boolean))].join(', ');
    const teacherSubjects = [...new Set(relevantEntries.map(e => e.learningArea?.name || e.learningArea?.shortName).filter(Boolean))].join(', ');

    // Calculate free periods
    const instructionalPeriodsCount = periods.filter(p => p.instructional !== false && p.type !== 'BREAK' && p.type !== 'LUNCH').length;
    const totalPossiblePeriods = instructionalPeriodsCount * days.length;
    const freePeriodsCount = Math.max(0, totalPossiblePeriods - teacherLessonsCount);

    const rowsHtml = periods.map(period => {
      const isBreak = !period.instructional || period.type === 'BREAK' || period.type === 'LUNCH';
      const isLunch = period.type === 'LUNCH';
      const isReg   = period.type === 'REGISTRATION' || period.type === 'ASSEMBLY';

      if (isBreak || isReg) {
        const emoji   = isLunch ? '🍽️' : isReg ? '✨' : '☕';
        const label   = period.name.toUpperCase();
        const bgColor = isLunch ? '#fff7ed' : isReg ? '#ecfdf5' : '#fffbeb';
        const bdrCol  = isLunch ? '#fed7aa' : isReg ? '#a7f3d0' : '#fde68a';
        const txtCol  = isLunch ? '#9a3412' : isReg ? '#065f46' : '#92400e';
        return `<tr>
          <td style="padding:8px;width:110px;font-size:10px;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;vertical-align:middle;">
            <div style="font-weight:800;color:#1e293b;">${period.name}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">${period.startTime}–${period.endTime}</div>
          </td>
          <td colspan="5" style="padding:10px 20px;background:${bgColor};border:1px solid ${bdrCol};">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:16px;">${emoji}</span>
              <div>
                <div style="font-size:12px;font-weight:900;color:${txtCol};letter-spacing:.08em;">${label}</div>
                <div style="font-size:9px;color:${txtCol};opacity:.7;margin-top:2px;">${period.startTime} – ${period.endTime}</div>
              </div>
            </div>
          </td>
        </tr>`;
      }

      const cells = days.map(day => {
        const dayEntries = lookup[`${day}::${period.startTime}`] || [];
        if (!dayEntries.length) {
          if (isTeacherPersonal) {
            return `<td style="padding:6px;min-height:56px;background:#fbfbfb;border:1px solid #e2e8f0;vertical-align:middle;text-align:center;">
              <div style="border:1px dashed #cbd5e1;border-radius:6px;padding:6px 4px;">
                <div style="font-size:9.5px;font-weight:700;color:#64748b;">Free Period</div>
                <div style="font-size:8px;color:#94a3b8;margin-top:1px;">Lesson Prep / Marking</div>
              </div>
            </td>`;
          }
          return `<td style="padding:8px;min-height:64px;background:#fafafa;border:1px solid #e2e8f0;"><span style="color:#cbd5e1;font-size:10px;">—</span></td>`;
        }

        if (isTeacherPersonal) {
          const inner = dayEntries.map(e => `
            <div style="padding:8px 10px;background:#eef2ff;border-radius:6px;border:1.5px solid #818cf8;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
              <div style="font-size:11px;font-weight:900;color:#1e1b4b;line-height:1.2;">${e.learningArea?.name || e.learningArea?.shortName || '—'}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span style="font-size:9.5px;font-weight:800;color:#3730a3;background:#c7d2fe;padding:2px 6px;border-radius:4px;">${e.class?.name || ''}</span>
                ${e.room?.name ? `<span style="font-size:9px;color:#475569;font-weight:600;">📍 ${e.room.name}</span>` : ''}
              </div>
            </div>`).join('');
          return `<td style="padding:6px;border:1px solid #e2e8f0;vertical-align:top;">${inner}</td>`;
        }

        const inner = dayEntries.map(e => `
          <div style="margin-bottom:4px;padding:6px 8px;background:#eef2ff;border-radius:6px;border:1px solid #c7d2fe;">
            <div style="font-size:10px;font-weight:800;color:#1e1b4b;">${e.learningArea?.shortName || e.learningArea?.name || '—'}</div>
            <div style="font-size:9px;color:#4338ca;margin-top:2px;">${e.class?.name || ''}</div>
            <div style="font-size:9px;color:#6b7280;">${e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : ''}</div>
            ${e.room?.name ? `<div style="font-size:9px;color:#9ca3af;">📍 ${e.room.name}</div>` : ''}
          </div>`).join('');
        return `<td style="padding:6px;border:1px solid #e2e8f0;vertical-align:top;">${inner}</td>`;
      }).join('');

      return `<tr>
        <td style="padding:8px;width:110px;font-size:10px;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;vertical-align:middle;">
          <div style="font-weight:800;color:#1e293b;">${period.name}</div>
          <div style="font-size:9px;color:#94a3b8;margin-top:2px;">${period.startTime}–${period.endTime}</div>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    const teacherBannerHtml = isTeacherPersonal ? `
      <div style="margin:10px 0 14px;padding:12px 18px;background:linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%);border:1.5px solid #c7d2fe;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:46px;height:46px;border-radius:50%;background:#4338ca;color:#fff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(67,56,202,0.25);">
            ${(activeTeacher.firstName?.[0] || '') + (activeTeacher.lastName?.[0] || '')}
          </div>
          <div>
            <div style="font-size:9px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:.1em;">TEACHER'S INDIVIDUAL SCHEDULE</div>
            <div style="font-size:20px;font-weight:900;color:#1e1b4b;letter-spacing:-.02em;margin-top:1px;">${activeTeacher.firstName} ${activeTeacher.lastName}</div>
            <div style="font-size:10px;color:#475569;margin-top:2px;">
              <strong>Assigned Subjects:</strong> ${teacherSubjects || '—'} &nbsp;•&nbsp; <strong>Classes:</strong> ${teacherClasses || '—'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;text-align:center;">
          <div style="background:#fff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 12px;min-width:76px;">
            <div style="font-size:18px;font-weight:900;color:#4338ca;">${teacherLessonsCount}</div>
            <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;">Weekly Lessons</div>
          </div>
          <div style="background:#fff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 12px;min-width:76px;">
            <div style="font-size:18px;font-weight:900;color:#059669;">${teacherTeachingDays}</div>
            <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;">Teaching Days</div>
          </div>
          <div style="background:#fff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 12px;min-width:76px;">
            <div style="font-size:18px;font-weight:900;color:#d97706;">${freePeriodsCount}</div>
            <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;">Prep Periods</div>
          </div>
        </div>
      </div>
    ` : `
      <div style="margin:10px 0 14px;padding:8px 16px;background:#f8fafc;border-left:4px solid ${brandColor};border-radius:4px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:900;color:#1e1b4b;text-transform:uppercase;letter-spacing:.05em;">MASTER INSTITUTIONAL TIMETABLE</div>
          <div style="font-size:10px;color:#64748b;">Comprehensive master allocation schedule for all classes and instructional spaces</div>
        </div>
        <div style="font-size:10px;font-weight:700;color:#1e1b4b;background:#e2e8f0;padding:4px 10px;border-radius:20px;">
          ${entries.length} Scheduled Lessons · ${new Set(entries.map(e => e.classId)).size} Active Classes
        </div>
      </div>
    `;

    const footerSignaturesHtml = isTeacherPersonal ? `
      <div class="footer">
        <div class="sig">Teacher: ${activeTeacher.firstName} ${activeTeacher.lastName}<span>Signature &amp; Date</span></div>
        <div class="sig">Head of Department / Senior Teacher<span>Signature &amp; Date</span></div>
        <div class="sig">Deputy Principal (Academics)<span>Signature &amp; Date</span></div>
        <div class="sig">Principal / Headteacher<span>Official Stamp &amp; Date</span></div>
      </div>
    ` : `
      <div class="footer">
        <div class="sig">Timetable Master<span>Signature &amp; Date</span></div>
        <div class="sig">Head of Department<span>Signature &amp; Date</span></div>
        <div class="sig">Deputy Principal (Academics)<span>Signature &amp; Date</span></div>
        <div class="sig">Principal / Headteacher<span>Official Stamp &amp; Date</span></div>
      </div>
    `;

    const pageSize = isTeacherPersonal ? 'A4 landscape' : 'A3 landscape';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${isTeacherPersonal ? `${activeTeacher.firstName} ${activeTeacher.lastName} - Timetable` : planTitle}</title>
    <style>
      @page { size: ${pageSize}; margin: 10mm 10mm; }
      * { box-sizing: border-box; }
      body { margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; color:#1e293b; }
      table { width:100%; border-collapse:collapse; }
      .footer { margin-top:20px; display:flex; justify-content:space-between; gap:24px; }
      .sig { flex:1; border-top:2px solid ${brandColor}; padding-top:8px; font-size:10px; font-weight:700; color:#1e293b; }
      .sig span { display:block; font-size:9px; font-weight:400; color:#94a3b8; margin-top:4px; }
    </style></head><body>
      <!-- Formatted Heading with School Logo and National CBE Identity -->
      <div style="background:#fff;padding:8px 0 12px;border-bottom:3px solid ${brandColor};display:flex;align-items:center;gap:18px;">
        <div style="width:68px;height:68px;border-radius:8px;border:1px solid #cbd5e1;padding:4px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <img src="${absoluteLogoUrl}" onerror="this.src='/branding/logo.png';this.onerror=null;" style="max-height:100%;max-width:100%;object-fit:contain;" alt="School Logo" />
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:8.5px;font-weight:800;color:#4338ca;letter-spacing:.14em;text-transform:uppercase;">
            Republic of Kenya &nbsp;·&nbsp; Ministry of Education &nbsp;·&nbsp; CBE Timetabling Framework
          </div>
          <div style="font-size:22px;font-weight:900;color:${brandColor};letter-spacing:-.02em;margin-top:2px;text-transform:uppercase;">
            ${schoolName}
          </div>
          ${schoolMotto ? `<div style="font-size:9.5px;font-style:italic;color:#475569;margin-top:1px;">"${schoolMotto}"</div>` : ''}
          <div style="font-size:9.5px;font-weight:600;color:#64748b;margin-top:2px;">
            ${[contactParts.join('  &nbsp;•&nbsp;  '), planTitle, [versionStr, termStr, yearStr].filter(Boolean).join(' · ')].filter(Boolean).join('  &nbsp;|&nbsp;  ')}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:8.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Generated</div>
          <div style="font-size:10px;font-weight:800;color:#1e293b;">${generatedOn}</div>
          <div style="margin-top:5px;padding:4px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:9px;font-weight:800;color:#16a34a;display:inline-block;">
            ${isTeacherPersonal ? 'OFFICIAL FACULTY COPY' : 'OFFICIAL MASTER COPY'}
          </div>
        </div>
      </div>

      ${teacherBannerHtml}

      <table>
        <thead><tr>
          <th style="padding:10px 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;background:${brandColor};color:#fff;border:1px solid #312e81;width:110px;">TIME</th>
          ${dayHeaders}
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      ${footerSignaturesHtml}
    </body></html>`;

    const win = window.open('', '_blank', 'width=1280,height=900');
    if (!win) { return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch(e) { /* ignore */ } }, 600);
  };

  // ── Status badge ─────────────────────────────────────────────────────────
  const statusBadge = {
    DRAFT:             { label: 'Draft',             cls: 'bg-gray-100 text-gray-600' },
    GENERATED:         { label: 'Generated',         cls: 'bg-indigo-50 text-indigo-700' },
    DEPARTMENT_REVIEW: { label: 'Dept. review',      cls: 'bg-amber-50 text-amber-700' },
    DEPUTY_REVIEW:     { label: 'Deputy review',     cls: 'bg-amber-50 text-amber-700' },
    PRINCIPAL_REVIEW:  { label: 'Principal review',  cls: 'bg-amber-50 text-amber-700' },
    APPROVED:          { label: 'Approved',          cls: 'bg-emerald-50 text-emerald-700' },
    PUBLISHED:         { label: 'Published',         cls: 'bg-emerald-600 text-white' },
    LOCKED:            { label: 'Locked',            cls: 'bg-slate-700 text-white' },
    ARCHIVED:          { label: 'Archived',          cls: 'bg-gray-200 text-gray-500' },
  }[version.status] ?? { label: version.status, cls: 'bg-gray-100 text-gray-600' };

  if (loading) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Publish confirmation dialog */}
      {showPublishDialog && (
        <PublishConfirmDialog
          plan={plan}
          version={version}
          entryCount={entries.length}
          overrideCount={overrideCount}
          onConfirm={handlePublish}
          onCancel={() => setShowPublishDialog(false)}
          publishing={publishing}
        />
      )}

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{plan.name}</h3>
              <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Version {version.version}
              {isReadOnly ? ' · Read-only' : ' · Drag unlocked lessons to another period'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Interactive Conflict Resolution Assistant Badge */}
          {hardConflicts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConflictAssistant(true)}
              className="h-9 px-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-100 hover:border-rose-400 transition-all shadow-2xs cursor-pointer"
              title="Click to view intelligent conflict diagnosis and 1-click fixes"
            >
              <AlertTriangle size={14} className="text-rose-600 animate-pulse" />
              <span>{hardConflicts.length} conflict{hardConflicts.length !== 1 ? 's' : ''}</span>
              <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-bold uppercase">Fix</span>
            </button>
          )}
          {conflicts.length > 0 && hardConflicts.length === 0 && (
            <button
              type="button"
              onClick={() => setShowConflictAssistant(true)}
              className="h-9 px-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-2xs cursor-pointer"
              title="Click to inspect warnings and suggestions"
            >
              <AlertTriangle size={14} className="text-amber-600" />
              <span>{conflicts.length} warning{conflicts.length !== 1 ? 's' : ''}</span>
              <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">Fix</span>
            </button>
          )}

          {/* Edit controls — hidden for read-only statuses */}
          {!isReadOnly && (
            <>
              <button disabled={!history.length || Boolean(savingId)} onClick={undo} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50" title="Undo">
                <Undo2 size={16} />
              </button>
              <button disabled={!future.length || Boolean(savingId)} onClick={redo} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50" title="Redo">
                <Redo2 size={16} />
              </button>
            </>
          )}

          <button onClick={load} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50" title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowCoverageModal(true)}
            className="h-9 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
            title="Review unfilled spaces and active class coverage"
          >
            <ClipboardCheck size={14} className="text-indigo-600" />
            Coverage Report
          </button>
          <button onClick={exportExcel} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50" title="Export Excel">
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={() => exportPdf(activeTeacherObj)}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title={activeTeacherObj ? `Export Personal Timetable for ${activeTeacherObj.firstName} ${activeTeacherObj.lastName} (PDF)` : "Export Master Timetable (PDF)"}
          >
            <Download size={16} />
          </button>
          {onToggleFullScreen && (
            <button
              type="button"
              onClick={onToggleFullScreen}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              title={isFullScreen ? 'Restore standard width' : 'Full screen mode'}
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button disabled={Boolean(action)} onClick={clone} className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold flex items-center gap-2 hover:bg-gray-50 disabled:opacity-40" title="Create a new editable copy of this version">
            <GitBranch size={14} /> New version
          </button>

          {/* Submit for review — visible while in workflow but not yet APPROVED */}
          {nextStatus && canEdit && !isReadOnly && (
            <button
              disabled={Boolean(action) || hardConflicts.length > 0}
              onClick={advance}
              className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40 hover:bg-indigo-700"
              title={hardConflicts.length > 0 ? 'Resolve all hard conflicts before submitting' : `Advance to ${nextStatus.replaceAll('_', ' ').toLowerCase()}`}
            >
              {action === 'review' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit review
            </button>
          )}

          {/* Publish button — only visible once APPROVED */}
          {version.status === 'APPROVED' && canEdit && (
            <button
              disabled={!canPublish || Boolean(action) || publishing}
              onClick={() => setShowPublishDialog(true)}
              className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40 hover:bg-emerald-700"
              title={hardConflicts.length > 0 ? 'Resolve all hard conflicts before publishing' : 'Publish this timetable as the live schedule'}
            >
              <Upload size={14} /> Publish
            </button>
          )}

          {/* Reset draft — clear lessons and return to empty draft */}
          {!isReadOnly && canEdit && (
            <button
              disabled={!entries.length || Boolean(action)}
              onClick={handleResetDraft}
              className="h-9 px-3 rounded-lg border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 disabled:opacity-40"
              title="Clear all lessons and return draft to blank grid"
            >
              {action === 'reset' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Reset draft
            </button>
          )}

          {/* Published indicator and Reset Live option */}
          {version.status === 'PUBLISHED' && (
            <div className="flex items-center gap-2">
              <span className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={14} /> Live
              </span>
              {canEdit && (
                <button
                  disabled={Boolean(action)}
                  onClick={handleResetLive}
                  className="h-9 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-100"
                  title="Unpublish this timetable and remove all lessons from live schedule"
                >
                  {action === 'resetLive' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  Reset live
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analytics summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Teachers', analytics.teachers.length], ['Classes covered', analytics.classes.length], ['Rooms used', analytics.rooms.length], ['Lesson periods', entries.length]].map(([label, value]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-xl font-semibold text-gray-900">{value}</p>
            <p className="text-[10px] uppercase font-semibold text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Teacher workload */}
      {!!analytics.teachers.length && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Teacher workload</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {analytics.teachers.sort((a, b) => b.periods - a.periods).map(item => (
              <div key={item.id} className="rounded-lg bg-gray-50 p-3 flex justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800">{item.name}</p>
                  <p className="text-[10px] text-gray-500">{item.days} teaching day{item.days !== 1 ? 's' : ''}</p>
                </div>
                <span className={`text-xs font-bold ${item.periods > 30 ? 'text-rose-600' : item.periods > 24 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {item.periods}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View & Search Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">
            <Filter size={14} className="text-indigo-600" />
            <span>Filter Grid:</span>
          </div>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="ALL">All Classes ({availableClasses.length})</option>
            {availableClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Teacher Filter */}
          <select
            value={teacherFilter}
            onChange={e => setTeacherFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="ALL">All Teachers ({availableTeachers.length})</option>
            {availableTeachers.map(t => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>

          {/* Only Conflicts toggle */}
          {conflicts.length > 0 && (
            <button
              type="button"
              onClick={() => setOnlyConflictsFilter(prev => !prev)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                onlyConflictsFilter
                  ? 'bg-rose-500 border-rose-600 text-white shadow-2xs'
                  : 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle size={13} />
              {onlyConflictsFilter ? 'Showing Conflicts Only' : 'Show Conflicts Only'}
            </button>
          )}

          {/* Reset Filters */}
          {(classFilter !== 'ALL' || teacherFilter !== 'ALL' || onlyConflictsFilter || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setClassFilter('ALL');
                setTeacherFilter('ALL');
                setOnlyConflictsFilter(false);
                setSearchQuery('');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search subject or teacher…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Teacher Personal Schedule Banner */}
      {activeTeacherObj && (() => {
        const teacherEntries = entries.filter(e => e.teacherId === activeTeacherObj.id);
        const daysTaught = new Set(teacherEntries.map(e => e.day)).size;
        const classesTaught = [...new Set(teacherEntries.map(e => e.class?.name).filter(Boolean))];
        const subjectsTaught = [...new Set(teacherEntries.map(e => e.learningArea?.name || e.learningArea?.shortName).filter(Boolean))];
        const instructionalCount = periods.filter(p => p.instructional !== false && p.type !== 'BREAK' && p.type !== 'LUNCH').length;
        const freeCount = Math.max(0, instructionalCount * days.length - teacherEntries.length);

        return (
          <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                {(activeTeacherObj.firstName?.[0] || '') + (activeTeacherObj.lastName?.[0] || '')}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Faculty Personal Timetable
                  </span>
                  <span className="text-xs text-gray-500">• {teacherEntries.length} periods/week</span>
                </div>
                <h4 className="text-base font-bold text-gray-900 truncate">
                  {activeTeacherObj.firstName} {activeTeacherObj.lastName}
                </h4>
                <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  {subjectsTaught.length > 0 && (
                    <span><strong>Subjects:</strong> {subjectsTaught.join(', ')}</span>
                  )}
                  {classesTaught.length > 0 && (
                    <span><strong>Classes:</strong> {classesTaught.join(', ')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-center">
                <div className="px-3 py-1.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                  <p className="text-xs font-black text-indigo-700">{teacherEntries.length}</p>
                  <p className="text-[9px] font-semibold uppercase text-gray-400">Lessons</p>
                </div>
                <div className="px-3 py-1.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                  <p className="text-xs font-black text-emerald-600">{daysTaught}d</p>
                  <p className="text-[9px] font-semibold uppercase text-gray-400">Teaching</p>
                </div>
                <div className="px-3 py-1.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                  <p className="text-xs font-black text-amber-600">{freeCount}</p>
                  <p className="text-[9px] font-semibold uppercase text-gray-400">Prep/Free</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportPdf(activeTeacherObj)}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                title={`Generate official PDF schedule for ${activeTeacherObj.firstName} ${activeTeacherObj.lastName}`}
              >
                <Printer size={15} />
                <span>Print Teacher Timetable (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setTeacherFilter('ALL')}
                className="h-10 w-10 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
                title="Exit teacher personal view and return to full master grid"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Timetable grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
        <div
          className="grid min-w-[980px]"
          style={{ gridTemplateColumns: '120px repeat(5, minmax(170px, 1fr))' }}
          role="grid"
          aria-label={`Weekly timetable for ${plan.name}, version ${version.version}`}
          aria-rowcount={periods.length + 1}
          aria-colcount={days.length + 1}
        >
          {/* Header row */}
          <div role="columnheader" aria-rowindex={1} aria-colindex={1} className="sticky left-0 z-20 bg-slate-50 p-3 border-b border-r border-gray-200 text-[10px] font-semibold uppercase text-gray-500">Time</div>
          {days.map((day, dayIndex) => (
            <div key={day} role="columnheader" aria-rowindex={1} aria-colindex={dayIndex + 2} className="sticky top-0 z-10 bg-slate-50 p-3 border-b border-r border-gray-200 text-xs font-semibold text-gray-700">{day}</div>
          ))}

          {/* Period rows */}
          {periods.flatMap((period, periodIndex) => {
            const rowIndex = periodIndex + 2; // +1 for 1-based ARIA indices, +1 for header row
            const isBreak = !period.instructional || period.type === 'BREAK' || period.type === 'LUNCH';
            const isLunch = period.type === 'LUNCH';
            const isReg   = period.type === 'REGISTRATION' || period.type === 'ASSEMBLY';

            if (isBreak || isReg) {
              // Full-width banner row spanning all 5 day columns
              const gradientCls = isLunch
                ? 'from-orange-50 via-amber-50 to-orange-50 border-orange-200/80'
                : isReg
                ? 'from-cyan-50 via-sky-50 to-cyan-50 border-cyan-200/80'
                : 'from-amber-50 via-yellow-50 to-amber-50 border-amber-200/80';
              const textCls = isLunch ? 'text-orange-950' : isReg ? 'text-cyan-950' : 'text-amber-950';
              const timeCls = isLunch ? 'text-orange-600 bg-orange-100 border-orange-200' : isReg ? 'text-cyan-600 bg-cyan-100 border-cyan-200' : 'text-amber-700 bg-amber-100 border-amber-200';
              const emoji   = isLunch ? '🍽️' : isReg ? '✨' : '☕';
              return [
                // Time column
                <div key={`${period.id}-time`} role="rowheader" aria-rowindex={rowIndex} aria-colindex={1} className="sticky left-0 z-10 bg-white p-3 border-b border-r border-gray-200">
                  <p className="text-[10px] font-bold text-gray-500">{period.name}</p>
                  <p className="text-[9px] text-gray-400">{period.startTime}–{period.endTime}</p>
                </div>,
                // Banner spanning all 5 days
                <div
                  key={`${period.id}-banner`}
                  role="gridcell"
                  aria-rowindex={rowIndex}
                  aria-colindex={2}
                  aria-colspan={days.length}
                  className={`col-span-5 bg-gradient-to-r ${gradientCls} border-b flex items-center gap-4 px-6 py-3`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-extrabold ${textCls} uppercase tracking-widest`}>{period.name}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${timeCls}`}>
                    {period.startTime} – {period.endTime}
                  </span>
                </div>,
              ];
            }

            // Regular instructional period
            return [
              <div key={`${period.id}-time`} role="rowheader" aria-rowindex={rowIndex} aria-colindex={1} className="sticky left-0 z-10 bg-white p-3 border-b border-r border-gray-200">
                <p className="text-xs font-semibold text-gray-800">{period.name}</p>
                <p className="text-[10px] text-gray-500">{period.startTime}–{period.endTime}</p>
              </div>,
              ...days.map((day, dayIndex) => (
                <div
                  key={`${period.id}-${day}`}
                  role="gridcell"
                  aria-rowindex={rowIndex}
                  aria-colindex={dayIndex + 2}
                  aria-label={`${day}, ${period.name}, ${period.startTime} to ${period.endTime}`}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => move(event, day, period)}
                  className="min-h-24 p-2 border-b border-r border-gray-200 bg-gray-50/30 hover:bg-indigo-50/50 space-y-1.5"
                >
                  {filteredEntries
                    .filter(entry => entry.day === day && entry.startTime === period.startTime)
                    .map(entry => {
                      const hasConflict = conflictedIds.has(entry.id);
                      const isHighlighted = highlightedEntryId === entry.id;

                      const openEditor = () => {
                        const conflictObj = conflicts.find(c => c.entryIds?.includes(entry.id));
                        setSelectedEntryForFix({ entry, conflict: conflictObj });
                      };
                      const teacherLabel = entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'no teacher assigned';
                      const canMove = canEdit && !entry.locked && !isReadOnly;
                      const cardLabel = `${entry.learningArea?.name || entry.learningArea?.shortName || 'Lesson'}, ${entry.class?.name || ''}, ${teacherLabel}${hasConflict ? ', has a conflict' : ''}. ${canMove ? 'Press Enter to inspect, edit, or move this lesson.' : 'Press Enter to inspect this lesson.'}`;

                      return (
                        <div
                          id={`entry-card-${entry.id}`}
                          key={entry.id}
                          role="button"
                          tabIndex={0}
                          aria-label={cardLabel}
                          draggable={canMove}
                          onDragStart={event => event.dataTransfer.setData('text/timetable-entry', entry.id)}
                          onClick={openEditor}
                          onKeyDown={event => {
                            // Ignore bubbled keydowns from the nested lock button — only
                            // act when the card itself is the focused element.
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openEditor();
                            }
                          }}
                          className={`rounded-lg border p-2 shadow-xs transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
                            ${entry.locked || !canEdit || isReadOnly ? 'bg-gray-100/90 border-gray-200' : 'bg-white border-indigo-100 hover:border-indigo-300 hover:shadow-sm'}
                            ${hasConflict ? 'ring-2 ring-rose-400 bg-rose-50/70 border-rose-300' : ''}
                            ${isHighlighted ? 'ring-4 ring-indigo-600 scale-[1.03] shadow-lg z-20 bg-indigo-50' : ''}
                          `}
                        >
                          <div className="flex justify-between gap-2">
                            <p className="text-[11px] font-bold text-gray-900 truncate">
                              {entry.learningArea?.shortName || entry.learningArea?.name}
                            </p>
                            {canEdit && !isReadOnly && (
                              <button
                                disabled={savingId === entry.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyChange(entry.id, { locked: !entry.locked }).then(() =>
                                    showSuccess(entry.locked ? 'Lesson unlocked' : 'Lesson locked')
                                  );
                                }}
                                className="text-gray-400 hover:text-indigo-600 shrink-0 p-0.5"
                                title={entry.locked ? 'Unlock lesson' : 'Lock lesson'}
                              >
                                {entry.locked ? <Lock size={12} className="text-amber-600" /> : <Unlock size={12} />}
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-indigo-700 truncate font-semibold">{entry.class?.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'Teacher unassigned'}
                          </p>

                          {/* Interactive Conflict Indicator */}
                          {hasConflict && (
                            <div className="mt-1.5 flex items-center justify-between bg-rose-100/90 border border-rose-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-rose-800">
                              <span className="flex items-center gap-1">
                                <AlertTriangle size={10} className="text-rose-600 shrink-0" /> Conflict
                              </span>
                              <span className="underline font-semibold">Click to Fix</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )),
            ];
          })}
        </div>
      </div>

      {/* Coverage / Gap Analysis Modal */}
      {showCoverageModal && (
        <CoverageReportModal
          version={version}
          plan={plan}
          onClose={() => setShowCoverageModal(false)}
        />
      )}

      {/* Conflict Resolution Assistant Modal */}
      <ConflictAssistantModal
        open={showConflictAssistant}
        onClose={() => setShowConflictAssistant(false)}
        conflicts={conflicts}
        entries={entries}
        teachers={availableTeachers}
        onLocateEntry={locateEntryInGrid}
        onQuickFixEntry={(entry, conflict) => setSelectedEntryForFix({ entry, conflict })}
        onNavigateToAvailability={onNavigateSection}
      />

      {/* Lesson Quick Fix / Edit Modal */}
      {selectedEntryForFix && (
        <LessonQuickFixModal
          entry={selectedEntryForFix.entry}
          conflict={selectedEntryForFix.conflict || conflicts.find(c => c.entryIds?.includes(selectedEntryForFix.entry.id))}
          onClose={() => setSelectedEntryForFix(null)}
          entries={entries}
          teachers={availableTeachers}
          rooms={availableRooms}
          periods={periods}
          availabilityRules={availabilityRules}
          onSave={applyChange}
          onNavigateToAvailability={onNavigateSection}
          canEdit={canEdit && !isReadOnly}
        />
      )}
    </div>
  );
};

export default TimetableDraftEditor;
