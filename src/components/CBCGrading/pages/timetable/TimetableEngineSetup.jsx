import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangle, Award, BookOpenCheck, Building2, Calendar, CalendarClock, Check, CheckCircle2, CheckSquare, ChevronDown, ChevronUp, Clock3, Coffee, Edit2, ExternalLink, GitBranch, Layers, Loader2, Maximize2, Minimize2, Play, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, Square, Trash2, Upload, UserCheck, UserX, Users, X } from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import TimetableDraftEditor from './TimetableDraftEditor';
import TimetableWalkthrough from './TimetableWalkthrough';
import { GRADES, getGradeLabel } from '../../../../constants/grades';
import { getDynamicAcademicYears } from '../../utils/academicYear';
import { SCHOOL_DAYS, SCHEDULE_PRESETS, ROOM_TYPES, PERIOD_TYPES } from '../../../../constants/timetable';
import { buildPeriods } from '../../../../utils/timeFormat';

const formatGradeName = (grade) => {
  if (!grade) return 'Unknown Grade';
  return getGradeLabel(grade) || String(grade).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const fieldClass = 'w-full h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400';
const labelClass = 'block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5';
const currentYear = new Date().getFullYear();

const Metric = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}><Icon size={19} /></div>
    <div><p className="text-xl font-semibold text-gray-900 leading-none">{value}</p><p className="text-xs text-gray-500 mt-1">{label}</p></div>
  </div>
);

// ── Period type pill ──────────────────────────────────────────────────────────
const periodTypeCls = (type) =>
  type === 'BREAK' || type === 'LUNCH'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : type === 'REGISTRATION' || type === 'ASSEMBLY'
    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
    : 'bg-indigo-50 text-indigo-700 border-indigo-200';

// ── Version status badge ──────────────────────────────────────────────────────
const versionBadgeCls = (status) => ({
  DRAFT:             'bg-gray-100 text-gray-600',
  GENERATED:         'bg-indigo-50 text-indigo-700',
  DEPARTMENT_REVIEW: 'bg-amber-50 text-amber-700',
  DEPUTY_REVIEW:     'bg-amber-50 text-amber-700',
  PRINCIPAL_REVIEW:  'bg-amber-50 text-amber-700',
  APPROVED:          'bg-emerald-50 text-emerald-700',
  PUBLISHED:         'bg-emerald-600 text-white',
  LOCKED:            'bg-slate-700 text-white',
  ARCHIVED:          'bg-gray-200 text-gray-500',
}[status] ?? 'bg-gray-100 text-gray-600');

// ── Inline editable field ─────────────────────────────────────────────────────
const InlineEdit = ({ value, onSave, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) return (
    <button onClick={() => { setDraft(value); setEditing(true); }} disabled={disabled}
      className="group flex items-center gap-1 text-left hover:text-indigo-600 disabled:cursor-default">
      <span className="font-semibold text-gray-900">{value}</span>
      {!disabled && <Edit2 size={11} className="opacity-0 group-hover:opacity-60" />}
    </button>
  );
  return (
    <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); onSave(draft); setEditing(false); }}>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        className="h-7 px-2 rounded border border-indigo-300 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400 w-40" />
      <button type="submit" className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
    </form>
  );
};

// ── Relief Cover Workbench Modal ─────────────────────────────────────────────
const ReliefCoverModal = ({ impact, onClose, onAssign, onBatchAutoAssign, assigning }) => {
  const [selectedReliefs, setSelectedReliefs] = useState({});

  if (!impact) return null;

  const { teacher, day, affectedLessons = [] } = impact;

  const handleSelectRelief = (lessonId, teacherId) => {
    setSelectedReliefs(prev => ({ ...prev, [lessonId]: teacherId }));
  };

  const handleConfirmAll = () => {
    const assignments = affectedLessons
      .filter(l => selectedReliefs[l.lesson.id])
      .map(l => ({ scheduleId: l.lesson.id, reliefTeacherId: selectedReliefs[l.lesson.id], reason: 'Emergency leave cover' }));
    if (assignments.length > 0) onBatchAutoAssign(assignments);
  };

  const autoAssignments = affectedLessons
    .filter(l => l.bestRecommendation)
    .map(l => ({ scheduleId: l.lesson.id, reliefTeacherId: l.bestRecommendation.teacher.id, reason: 'Auto-assigned cover' }));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-rose-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">⚡ Relief Cover Workbench</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {teacher?.firstName} {teacher?.lastName} · {day} · {affectedLessons.length} affected lesson{affectedLessons.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <X size={16} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 shrink-0">
          <p className="text-xs text-orange-800 leading-relaxed">
            <span className="font-bold">Orphaned lessons detected.</span> The timetable is live — students expect these lessons today.
            Assign a substitute teacher below. The sub will see the cover lesson appear on their dashboard immediately.
            The master timetable is <span className="font-bold">not affected</span>.
          </p>
        </div>

        {/* Lesson List */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {affectedLessons.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No affected lessons found</p>
              <p className="text-xs text-gray-500 mt-1">This teacher has no published lessons on {day}.</p>
            </div>
          ) : (
            affectedLessons.map((item, idx) => {
              const { lesson, candidates, freeCount, bestRecommendation } = item;
              const freeCandidates = candidates.filter(c => c.isFree);
              const specialists = freeCandidates.filter(c => c.matchesSubject);
              const generals = freeCandidates.filter(c => !c.matchesSubject);
              const chosen = selectedReliefs[lesson.id];

              return (
                <div key={lesson.id} className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{lesson.subject || lesson.learningArea?.name || 'Lesson'}</span>
                        <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">{lesson.className}</span>
                        <span className="text-[10px] text-gray-500">{lesson.startTime}–{lesson.endTime}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{freeCount} teacher{freeCount !== 1 ? 's' : ''} free · {specialists.length} subject specialist{specialists.length !== 1 ? 's' : ''}</p>
                    </div>
                    {bestRecommendation && !chosen && (
                      <button
                        onClick={() => onAssign(lesson.id, bestRecommendation.teacher.id)}
                        disabled={assigning}
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
                      >
                        {assigning ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        1-Click Assign {bestRecommendation.teacher.firstName}
                      </button>
                    )}
                    {chosen && (
                      <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={11} /> Cover Assigned
                      </span>
                    )}
                  </div>

                  {/* Candidates */}
                  {freeCount === 0 ? (
                    <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
                      <p className="text-xs text-rose-700 font-semibold">⚠ No free teachers at this time. All staff are busy or have blackout rules.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {specialists.length > 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Subject Specialists</p>
                      )}
                      {specialists.map(c => (
                        <div key={c.teacher.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border transition ${
                          chosen === c.teacher.id ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-100 hover:border-emerald-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-xs font-bold">
                              {c.teacher.firstName?.[0]}{c.teacher.lastName?.[0]}
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{c.teacher.firstName} {c.teacher.lastName}</span>
                              <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Specialist</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectRelief(lesson.id, c.teacher.id)}
                            className={`h-7 px-3 rounded-lg text-xs font-semibold transition ${
                              chosen === c.teacher.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-800'
                            }`}
                          >
                            {chosen === c.teacher.id ? '✓ Selected' : 'Select'}
                          </button>
                        </div>
                      ))}

                      {generals.length > 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2">Other Available Teachers</p>
                      )}
                      {generals.map(c => (
                        <div key={c.teacher.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border transition ${
                          chosen === c.teacher.id ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-100 hover:border-indigo-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 text-white flex items-center justify-center text-xs font-bold">
                              {c.teacher.firstName?.[0]}{c.teacher.lastName?.[0]}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{c.teacher.firstName} {c.teacher.lastName}</span>
                          </div>
                          <button
                            onClick={() => handleSelectRelief(lesson.id, c.teacher.id)}
                            className={`h-7 px-3 rounded-lg text-xs font-semibold transition ${
                              chosen === c.teacher.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-800'
                            }`}
                          >
                            {chosen === c.teacher.id ? '✓ Selected' : 'Select'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {autoAssignments.length > 0 && (
              <button
                onClick={() => onBatchAutoAssign(autoAssignments)}
                disabled={assigning}
                className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                {assigning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Auto-Assign All Best Matches ({autoAssignments.length})
              </button>
            )}
            {Object.keys(selectedReliefs).length > 0 && (
              <button
                onClick={handleConfirmAll}
                disabled={assigning}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                {assigning ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Confirm {Object.keys(selectedReliefs).length} Selection{Object.keys(selectedReliefs).length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Curriculum Deficit Modal ───────────────────────────────────────────────────
const CurriculumDeficitModal = ({ report, loading, onClose }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <BookOpenCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">📊 Curriculum Continuity Audit</h3>
              <p className="text-xs text-gray-500 mt-0.5">{report?.academicYear} · Syllabus delivery health check</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-indigo-500" />
              <span className="ml-3 text-sm text-gray-500">Analysing curriculum delivery…</span>
            </div>
          ) : !report ? (
            <p className="text-sm text-gray-400 text-center py-8">No report data available.</p>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900">{report.totalLessons}</p>
                  <p className="text-[11px] text-gray-500 mt-1">Total Lessons</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-emerald-700">{report.regularLessons}</p>
                  <p className="text-[11px] text-emerald-700 mt-1">Canonical Delivery</p>
                </div>
                <div className={`rounded-xl p-4 text-center shadow-sm border ${
                  report.reliefCoverLessons > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
                }`}>
                  <p className={`text-2xl font-bold ${ report.reliefCoverLessons > 0 ? 'text-orange-700' : 'text-gray-400' }`}>{report.reliefCoverLessons}</p>
                  <p className={`text-[11px] mt-1 ${ report.reliefCoverLessons > 0 ? 'text-orange-700' : 'text-gray-500' }`}>Relief Cover</p>
                </div>
                <div className={`rounded-xl p-4 text-center shadow-sm border ${
                  report.continuityRate >= 95 ? 'bg-emerald-50 border-emerald-200' :
                  report.continuityRate >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
                }`}>
                  <p className={`text-2xl font-bold ${
                    report.continuityRate >= 95 ? 'text-emerald-700' :
                    report.continuityRate >= 80 ? 'text-amber-700' : 'text-rose-700'
                  }`}>{report.continuityRate}%</p>
                  <p className={`text-[11px] mt-1 ${
                    report.continuityRate >= 95 ? 'text-emerald-700' :
                    report.continuityRate >= 80 ? 'text-amber-700' : 'text-rose-700'
                  }`}>Continuity Rate</p>
                </div>
              </div>

              {/* Health Banner */}
              <div className={`rounded-xl p-4 border ${
                report.continuityRate >= 95 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                report.continuityRate >= 80 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <p className="text-sm font-semibold">
                  {report.continuityRate >= 95 ? '✅ Excellent curriculum delivery — syllabus continuity is on track.' :
                   report.continuityRate >= 80 ? '⚠️ Moderate disruption — some subjects may be falling behind schedule.' :
                   '🚨 High disruption — significant portions of the curriculum are being covered by non-specialists. Review urgently.'}
                </p>
                <p className="text-xs mt-1 opacity-80">
                  {report.reliefCoverLessons} lesson{report.reliefCoverLessons !== 1 ? 's' : ''} have been handed to substitute teachers this {report.semester || 'term'}.
                  CBC guidelines recommend a maximum of 5% cover lessons per term for optimal learner outcomes.
                </p>
              </div>

              {/* Staff Cover Workload Table */}
              {report.teacherWorkloads?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-sm font-bold text-gray-700">Staff Cover Workload Distribution</h4>
                    <p className="text-[11px] text-gray-500">Sorted by relief burden — prevents burnout</p>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {report.teacherWorkloads.map(t => (
                      <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          t.coverLessons > 3 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                          <p className="text-[11px] text-gray-500">{t.regularLessons} regular · {t.coverLessons} cover lessons</p>
                        </div>
                        <div className="text-right shrink-0">
                          {t.coverLessons > 0 && (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                              t.coverLessons > 5 ? 'bg-rose-100 text-rose-700' :
                              t.coverLessons > 2 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {t.coverLessons} cover{t.coverLessons !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
          <button onClick={onClose} className="h-9 px-5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Period Edit Modal with Cascade Shift ──────────────────────────────────────
const PeriodEditModal = ({ period, onClose, onSave }) => {
  const [name, setName] = useState(period.name);
  const [type, setType] = useState(period.type);
  const [startTime, setStartTime] = useState(period.startTime);
  const [endTime, setEndTime] = useState(period.endTime);
  const [cascade, setCascade] = useState(true);
  const [saving, setSaving] = useState(false);

  const toMinutes = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const oldDuration = toMinutes(period.endTime) - toMinutes(period.startTime);
  const newDuration = toMinutes(endTime) - toMinutes(startTime);
  const delta = newDuration - oldDuration;

  const handleTypeSelect = (newType) => {
    setType(newType);
    if ((newType === 'BREAK' || newType === 'LUNCH') && name.startsWith('Period ')) {
      setName(newType === 'BREAK' ? 'Short Break' : 'Lunch Break');
    } else if (newType === 'LESSON' && (name === 'Short Break' || name === 'Lunch Break')) {
      setName(`Period ${period.sequence}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newDuration <= 0) {
      alert('End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      const instructional = type === 'LESSON';
      await onSave({ name, type, instructional, startTime, endTime }, cascade);
      onClose();
    } catch {
      // error handled in caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-indigo-50/30">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Edit Period #{period.sequence}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{period.scheduleName || 'Bell Schedule'}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Period Name */}
          <div>
            <label className={labelClass}>Period Name / Label</label>
            <input
              className={fieldClass}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Period 1, Morning Tea, Lunch Break"
              required
            />
          </div>

          {/* Period Type Selection */}
          <div>
            <label className={labelClass}>Period Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'LESSON', label: 'Lesson', icon: BookOpenCheck },
                { id: 'BREAK', label: 'Break', icon: Coffee },
                { id: 'LUNCH', label: 'Lunch', icon: Coffee },
                { id: 'REGISTRATION', label: 'Registration', icon: Clock3 },
                { id: 'ASSEMBLY', label: 'Assembly', icon: Users },
              ].map(item => {
                const Icon = item.icon;
                const isSel = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTypeSelect(item.id)}
                    className={`py-2 px-2.5 rounded-lg border text-left flex items-center gap-1.5 transition-all ${
                      isSel
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-400 font-semibold'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 text-gray-600 text-xs'
                    }`}
                  >
                    <Icon size={12} className={isSel ? 'text-indigo-600' : 'text-gray-400'} />
                    <span className="text-[11px] truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timing Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                className={fieldClass}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="time"
                className={fieldClass}
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Duration info box */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2.5 flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">Calculated Duration:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{newDuration > 0 ? `${newDuration} min` : 'Invalid'}</span>
              {delta !== 0 && newDuration > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${delta > 0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {delta > 0 ? `+${delta}m longer` : `${delta}m shorter`}
                </span>
              )}
            </div>
          </div>

          {/* Cascade shift toggle */}
          <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cascade}
                onChange={e => setCascade(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <p className="font-semibold text-indigo-950">Cascade shift subsequent periods</p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  {cascade && delta !== 0
                    ? `Automatically adjust all periods following this one by ${delta > 0 ? `+${delta}` : delta} minutes.`
                    : 'Auto-recalculate start and end times for all periods following this one when duration changes.'}
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 px-4 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || newDuration <= 0}
              className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-40 shadow-sm"
            >
              {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Room code auto-increment & class helpers ─────────────────────────────────
const getNextRoomCode = (existingRooms = [], offset = 0) => {
  const existingCodes = new Set(
    (existingRooms || [])
      .map(r => (r.code || '').trim().toUpperCase())
      .filter(Boolean)
  );

  let maxNum = 0;
  let detectedPrefix = 'RM-';

  (existingRooms || []).forEach(r => {
    const c = (r.code || '').trim();
    if (!c) return;
    const match = c.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        if (prefix) detectedPrefix = prefix;
      }
    }
  });

  let candidateNum = Math.max(maxNum, (existingRooms || []).length) + 1 + offset;

  while (true) {
    const formatted = `${detectedPrefix}${String(candidateNum).padStart(2, '0')}`;
    if (!existingCodes.has(formatted.toUpperCase())) {
      return formatted;
    }
    candidateNum++;
  }
};

const normalizeRoomName = (name) => {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\bgrade\b/g, 'g')
    .replace(/\bplaygroup\b/g, 'pg')
    .replace(/[^a-z0-9]/g, '');
};

const formatShortClassName = (name) => {
  if (!name) return '';
  return String(name)
    .replace(/^Grade\s*/i, 'G')
    .replace(/^Playgroup\s*/i, 'PG ')
    .replace(/^Pre-Primary\s*(\d)/i, 'PP$1')
    .replace(/\s+/g, ' ')
    .trim();
};

const TimetableEngineSetup = ({ open, onClose, teachers = [], learningAreas = [], classes = [], canEdit = false }) => {
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [data, setData] = useState({ bellSchedules: [], rooms: [], allocations: [], availability: [], plans: [] });
  const [classList, setClassList] = useState(classes);
  const [section, setSection] = useState('overview');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [bell, setBell] = useState({ name: 'Standard', startTime: '08:00', duration: 40, count: 9, isDefault: true });
  const [room, setRoom] = useState({ name: '', code: '', type: 'CLASSROOM', capacity: 40 });
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [classSearch, setClassSearch] = useState('');
  const classDropdownRef = useRef(null);

  // Close interactive class dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target)) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [bulkCreatingRooms, setBulkCreatingRooms] = useState(false);
  const [allTeachersAvailable, setAllTeachersAvailable] = useState(() => {
    try {
      return localStorage.getItem('timetable_all_teachers_available') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleAllTeachersAvailable = () => {
    setAllTeachersAvailable(prev => {
      const next = !prev;
      try {
        localStorage.setItem('timetable_all_teachers_available', String(next));
      } catch {}
      return next;
    });
  };

  // ── Relief Cover & Deficit State ──────────────────────────────────────────
  const [reliefModal, setReliefModal] = useState(null); // { impact }
  const [deficitModal, setDeficitModal] = useState({ open: false, report: null, loading: false });
  const [reliefAssigning, setReliefAssigning] = useState(false);

  const checkAbsenceImpact = async (teacherId, day) => {
    if (!teacherId || !day) return;
    try {
      const res = await api.timetable.getAbsenceImpact({ teacherId, day });
      const impact = res?.data || res;
      if (impact?.hasOrphanedLessons) {
        setReliefModal({ impact });
      } else {
        showSuccess(`No orphaned lessons found for ${day}. The teacher has no published lessons that day.`);
      }
    } catch (err) {
      showError(err.message || 'Could not check absence impact');
    }
  };

  const handleAssignRelief = async (scheduleId, reliefTeacherId) => {
    setReliefAssigning(true);
    try {
      await api.timetable.assignRelief({ scheduleId, reliefTeacherId, reason: 'Emergency leave cover' });
      showSuccess('Relief cover assigned — substitute teacher dashboard updated.');
      setReliefModal(prev => {
        if (!prev) return null;
        // Mark this lesson as covered in the local state
        const updatedLessons = prev.impact.affectedLessons.map(l =>
          l.lesson.id === scheduleId ? { ...l, lesson: { ...l.lesson, isOverride: true } } : l
        );
        return { ...prev, impact: { ...prev.impact, affectedLessons: updatedLessons } };
      });
    } catch (err) {
      showError(err.message || 'Failed to assign relief cover');
    } finally {
      setReliefAssigning(false);
    }
  };

  const handleBatchAutoAssign = async (assignments) => {
    setReliefAssigning(true);
    try {
      const res = await api.timetable.batchAssignRelief({ assignments });
      const result = res?.data || res;
      showSuccess(`${result.count || assignments.length} cover assignment${(result.count || assignments.length) !== 1 ? 's' : ''} applied. All substitute teachers notified.`);
      setReliefModal(null);
    } catch (err) {
      showError(err.message || 'Batch assignment failed');
    } finally {
      setReliefAssigning(false);
    }
  };

  const openDeficitReport = async () => {
    setDeficitModal({ open: true, report: null, loading: true });
    try {
      const res = await api.timetable.getSyllabusDeficit();
      setDeficitModal({ open: true, report: res?.data || res, loading: false });
    } catch (err) {
      showError(err.message || 'Could not load curriculum audit');
      setDeficitModal({ open: false, report: null, loading: false });
    }
  };

  const [roomSearch, setRoomSearch] = useState('');
  const [roomFilterType, setRoomFilterType] = useState('ALL');
  const [allocation, setAllocation] = useState({ academicYear: currentYear, grade: 'GRADE_7', learningAreaId: '', targetWeeklyPeriods: 5 });
  const [availability, setAvailability] = useState({ teacherId: '', day: 'Monday', startTime: '08:00', endTime: '16:00', available: false, reason: '' });
  const [plan, setPlan] = useState({ name: `Main Timetable ${currentYear}`, academicYear: currentYear, term: 'TERM_1', bellScheduleId: '' });
  const [generation, setGeneration] = useState(null);
  const [generatingVersion, setGeneratingVersion] = useState('');
  const [publishingVersion, setPublishingVersion] = useState('');
  const [editing, setEditing] = useState(null);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [subjectAssignmentCount, setSubjectAssignmentCount] = useState(0);
  const [allocationGradeFilter, setAllocationGradeFilter] = useState('ALL');
  const [learningAreaList, setLearningAreaList] = useState(learningAreas);

  // Sync learningAreas prop
  useEffect(() => {
    if (learningAreas && learningAreas.length > 0) {
      setLearningAreaList(learningAreas);
    }
  }, [learningAreas]);

  // Load learning areas if not passed or empty
  useEffect(() => {
    if (open && (!learningAreaList || learningAreaList.length === 0)) {
      api.config?.getLearningAreas?.()
        .then(res => {
          const areas = res?.data || res || [];
          if (Array.isArray(areas) && areas.length > 0) setLearningAreaList(areas);
        })
        .catch(() => {});
    }
  }, [open]);

  // Sync classes prop
  useEffect(() => {
    if (classes && classes.length > 0) {
      setClassList(classes);
    }
  }, [classes]);

  // Load classes if not passed or empty
  useEffect(() => {
    if (open && (!classList || classList.length === 0)) {
      api.classes.getAll({ active: true })
        .then(res => {
          const cls = res?.data || res || [];
          if (Array.isArray(cls) && cls.length > 0) setClassList(cls);
        })
        .catch(() => {});
    }
  }, [open, section]);

  // Sort classes naturally (Grade 1 before Grade 2, etc.)
  const sortedClasses = useMemo(() => {
    return [...(classList || [])].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
    );
  }, [classList]);

  // Determine active classes already registered as rooms vs unassigned
  const { assignedClasses, unassignedClasses } = useMemo(() => {
    const assigned = [];
    const unassigned = [];
    const rooms = data.rooms || [];

    sortedClasses.forEach(c => {
      const cExact = (c.name || '').trim().toLowerCase();
      const cNorm = normalizeRoomName(c.name);
      const isAssigned = rooms.some(r => {
        const rExact = (r.name || '').trim().toLowerCase();
        const rNorm = normalizeRoomName(r.name);
        return rExact === cExact || (cNorm && rNorm && (rNorm === cNorm || rNorm.includes(cNorm) || cNorm.includes(rNorm)));
      });

      if (isAssigned) {
        assigned.push(c);
      } else {
        unassigned.push(c);
      }
    });

    return { assignedClasses: assigned, unassignedClasses: unassigned };
  }, [sortedClasses, data.rooms]);

  // Filtered unassigned classes for interactive dropdown
  const filteredUnassigned = useMemo(() => {
    if (!classSearch.trim()) return unassignedClasses;
    const q = classSearch.toLowerCase().trim();
    return unassignedClasses.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [unassignedClasses, classSearch]);

  // Filtered already-assigned classes for interactive dropdown
  const filteredAssigned = useMemo(() => {
    if (!classSearch.trim()) return assignedClasses;
    const q = classSearch.toLowerCase().trim();
    return assignedClasses.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [assignedClasses, classSearch]);

  // Check if all unassigned active classes are selected
  const areAllUnassignedSelected = useMemo(() => {
    if (!unassignedClasses.length) return false;
    return unassignedClasses.every(c => selectedClassIds.includes(c.id));
  }, [unassignedClasses, selectedClassIds]);

  // Preview label for selected classes
  const selectedClassNamesPreview = useMemo(() => {
    if (!selectedClassIds.length) return '';
    const names = selectedClassIds
      .map(id => (classList || []).find(c => c.id === id)?.name)
      .filter(Boolean);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  }, [selectedClassIds, classList]);

  // Filtered rooms for room directory list
  const filteredRooms = useMemo(() => {
    return (data.rooms || []).filter(r => {
      if (roomFilterType === 'CLASSROOM' && r.type !== 'CLASSROOM') return false;
      if (roomFilterType === 'SPECIALIZED' && r.type === 'CLASSROOM') return false;
      if (roomSearch) {
        const q = roomSearch.toLowerCase().trim();
        const matchName = (r.name || '').toLowerCase().includes(q);
        const matchCode = (r.code || '').toLowerCase().includes(q);
        const matchType = (r.type || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchType) return false;
      }
      return true;
    });
  }, [data.rooms, roomFilterType, roomSearch]);

  const classroomCount = useMemo(() => (data.rooms || []).filter(r => r.type === 'CLASSROOM').length, [data.rooms]);
  const specializedCount = useMemo(() => (data.rooms || []).filter(r => r.type !== 'CLASSROOM').length, [data.rooms]);

  // Auto-fill next room code if empty when entering rooms section or when rooms load
  useEffect(() => {
    if (section === 'rooms') {
      setRoom(prev => {
        if (!prev.code) {
          return { ...prev, code: getNextRoomCode(data.rooms) };
        }
        return prev;
      });
    }
  }, [section, data.rooms]);

  // Compute dynamic grade options
  const availableGrades = useMemo(() => {
    const gradeMap = new Map();

    // 1. Standard CBC grades
    GRADES.forEach(g => {
      gradeMap.set(g.value, g.label);
    });

    // 2. Senior School grades
    ['GRADE_10', 'GRADE_11', 'GRADE_12'].forEach(val => {
      if (!gradeMap.has(val)) {
        gradeMap.set(val, getGradeLabel(val) || val.replace('_', ' '));
      }
    });

    // 3. Active classes configured in the school
    (classList || []).forEach(c => {
      if (c?.grade) {
        const val = String(c.grade).trim().toUpperCase().replace(/\s+/g, '_');
        if (!gradeMap.has(val)) {
          gradeMap.set(val, getGradeLabel(c.grade) || c.name || c.grade);
        }
      }
    });

    // 4. Any grades already in existing allocations
    (data?.allocations || []).forEach(a => {
      if (a?.grade) {
        const val = String(a.grade).trim().toUpperCase().replace(/\s+/g, '_');
        if (!gradeMap.has(val)) {
          gradeMap.set(val, getGradeLabel(a.grade) || a.grade);
        }
      }
    });

    return Array.from(gradeMap.entries()).map(([value, label]) => ({ value, label }));
  }, [classList, data?.allocations]);

  const [customYears, setCustomYears] = useState([]);

  // Compute dynamic academic year options using centralized dynamic horizon
  const availableYears = useMemo(() => {
    const extra = [
      ...(customYears || []),
      ...(data?.allocations || []).map(a => a?.academicYear),
      ...(data?.plans || []).map(p => p?.academicYear),
      allocation.academicYear,
      plan.academicYear,
    ].filter(Boolean);

    return getDynamicAcademicYears({
      minPast: 5,
      minFuture: 8,
      extraYears: extra,
      order: 'asc'
    });
  }, [customYears, data?.allocations, data?.plans, allocation.academicYear, plan.academicYear]);

  const handleYearChange = (target, val) => {
    if (val === '__custom__') {
      const input = window.prompt('Enter custom academic year (e.g. 2035):');
      const yearNum = parseInt(input, 10);
      if (yearNum && yearNum >= 2000 && yearNum <= 2150) {
        setCustomYears(prev => [...new Set([...prev, yearNum])]);
        if (target === 'allocation') setAllocation(prev => ({ ...prev, academicYear: yearNum }));
        else if (target === 'plan') setPlan(prev => ({ ...prev, academicYear: yearNum }));
      }
    } else {
      const num = Number(val);
      if (target === 'allocation') setAllocation(prev => ({ ...prev, academicYear: num }));
      else if (target === 'plan') setPlan(prev => ({ ...prev, academicYear: num }));
    }
  };

  const activeLearningAreas = useMemo(() => {
    return (learningAreaList && learningAreaList.length > 0) ? learningAreaList : (learningAreas || []);
  }, [learningAreaList, learningAreas]);

  // Filter learning areas for the selected grade (if tagged with gradeLevel)
  const filteredLearningAreas = useMemo(() => {
    if (!allocation.grade) return activeLearningAreas;
    const norm = (s) => String(s || '').toUpperCase().replace(/[\s_-]+/g, '');
    const selectedGradeNorm = norm(allocation.grade);
    const matched = activeLearningAreas.filter(area => {
      if (!area.gradeLevel) return false;
      return norm(area.gradeLevel) === selectedGradeNorm;
    });
    if (matched.length > 0) return matched;
    const unassigned = activeLearningAreas.filter(area => !area.gradeLevel);
    return unassigned.length > 0 ? unassigned : activeLearningAreas;
  }, [activeLearningAreas, allocation.grade]);

  const [allocationSearch, setAllocationSearch] = useState('');
  const [collapsedGrades, setCollapsedGrades] = useState({});

  const toggleGradeCollapse = (grade) => {
    setCollapsedGrades(prev => ({ ...prev, [grade]: !prev[grade] }));
  };

  const expandAllGrades = () => setCollapsedGrades({});
  const collapseAllGrades = () => {
    const next = {};
    Object.keys(allocationsByGrade).forEach(g => { next[g] = true; });
    setCollapsedGrades(next);
  };

  // Distinct grades currently in allocations
  const allocatedGrades = useMemo(() => {
    const set = new Set((data?.allocations || []).map(a => a.grade).filter(Boolean));
    return Array.from(set).sort();
  }, [data?.allocations]);

  // Active school grades from configured classes
  const activeClassGrades = useMemo(() => {
    const set = new Set();
    (classList || []).forEach(c => {
      if (c?.active && c?.grade) {
        set.add(c.grade);
      }
    });
    if (set.size === 0) {
      availableGrades.forEach(g => set.add(g.value));
    }
    return Array.from(set);
  }, [classList, availableGrades]);

  // Group allocations by grade
  const allocationsByGrade = useMemo(() => {
    const groups = {};
    (data?.allocations || []).forEach(item => {
      const g = item.grade || 'UNASSIGNED';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    return groups;
  }, [data?.allocations]);

  // Metrics for allocated vs. unallocated grades
  const allocationMetrics = useMemo(() => {
    const norm = (s) => String(s || '').toUpperCase().replace(/[\s_-]+/g, '');
    const allocatedGradeKeys = Object.keys(allocationsByGrade);
    const allocatedNormSet = new Set(allocatedGradeKeys.map(norm));

    // Deduplicate active school grades by normalized string
    const uniqueSchoolGradesMap = new Map();
    activeClassGrades.forEach(g => {
      const normKey = norm(g);
      if (!uniqueSchoolGradesMap.has(normKey)) {
        uniqueSchoolGradesMap.set(normKey, g);
      }
    });

    const allocatedSchoolGrades = [];
    const unallocatedSchoolGrades = [];

    uniqueSchoolGradesMap.forEach((gradeValue, normKey) => {
      if (allocatedNormSet.has(normKey)) {
        allocatedSchoolGrades.push(gradeValue);
      } else {
        unallocatedSchoolGrades.push(gradeValue);
      }
    });

    const totalSchoolGrades = uniqueSchoolGradesMap.size;
    const totalAllocatedSubjects = (data?.allocations || []).length;
    const totalWeeklyPeriods = (data?.allocations || []).reduce((sum, a) => sum + (Number(a.targetWeeklyPeriods) || 0), 0);

    return {
      totalSchoolGrades,
      allocatedCount: allocatedSchoolGrades.length,
      unallocatedCount: unallocatedSchoolGrades.length,
      unallocatedSchoolGrades,
      allocatedSchoolGrades,
      totalAllocatedSubjects,
      totalWeeklyPeriods
    };
  }, [allocationsByGrade, activeClassGrades, data?.allocations]);

  // Filtered grade groups for display
  const displayedGradeGroups = useMemo(() => {
    const norm = (s) => String(s || '').toUpperCase().replace(/[\s_-]+/g, '');
    let grades = Object.keys(allocationsByGrade);

    if (allocationGradeFilter !== 'ALL') {
      const filterNorm = norm(allocationGradeFilter);
      grades = grades.filter(g => norm(g) === filterNorm);
    }

    const searchLower = allocationSearch.trim().toLowerCase();
    const result = [];

    for (const g of grades) {
      let items = allocationsByGrade[g] || [];
      if (searchLower) {
        items = items.filter(item => {
          const areaName = item.learningArea?.name || '';
          const gradeText = formatGradeName(item.grade);
          return areaName.toLowerCase().includes(searchLower) || gradeText.toLowerCase().includes(searchLower);
        });
      }
      if (items.length > 0) {
        result.push({
          grade: g,
          label: formatGradeName(g),
          items,
          totalPeriods: items.reduce((sum, it) => sum + (Number(it.targetWeeklyPeriods) || 0), 0)
        });
      }
    }

    return result;
  }, [allocationsByGrade, allocationGradeFilter, allocationSearch]);

  // All-versions panel per plan
  const [versionsPanel, setVersionsPanel] = useState(null); // { planId, versions }
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [calendarMilestones, setCalendarMilestones] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [response, assignmentsResp, milestonesResp] = await Promise.all([
        api.timetable.getFoundation(),
        api.subjectAssignments?.getAll?.({ active: true }).catch(() => null),
        api.timetable.getCalendarMilestones({ academicYear: currentYear }).catch(() => null)
      ]);
      const next = response.data || response;
      setData(next);
      if (!plan.bellScheduleId && next.bellSchedules?.[0]?.id) setPlan(current => ({ ...current, bellScheduleId: next.bellSchedules[0].id }));

      const assignList = assignmentsResp?.data || assignmentsResp || [];
      if (Array.isArray(assignList)) setSubjectAssignmentCount(assignList.length);

      const milestonesData = milestonesResp?.data || milestonesResp || null;
      setCalendarMilestones(milestonesData);
    } catch (error) {
      showError(error.message || 'Failed to load timetable engine setup');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = useMemo(() => [
    ['overview', 'Overview'], ['bells', 'Bell schedules'], ['rooms', 'Rooms'],
    ['allocations', 'Allocations'], ['availability', 'Availability'], ['plans', 'Plans']
  ], []);

  const submit = async (key, action, reset) => {
    setSaving(key);
    try { await action(); showSuccess('Timetable configuration saved'); await load(); reset?.(); }
    catch (error) { showError(error.message || 'Failed to save timetable configuration'); }
    finally { setSaving(''); }
  };

  // ── Bell schedule helpers ─────────────────────────────────────────────────
  const renameBellSchedule = async (id, name) => {
    try { await api.timetable.updateBellSchedule(id, { name }); showSuccess('Bell schedule renamed'); await load(); }
    catch (error) { showError(error.message || 'Could not rename bell schedule'); }
  };

  const toggleBellDefault = async (id, currentIsDefault) => {
    if (currentIsDefault) return; // already default — nothing to do
    try { await api.timetable.updateBellSchedule(id, { isDefault: true }); showSuccess('Default bell schedule updated'); await load(); }
    catch (error) { showError(error.message || 'Could not update default'); }
  };

  const toggleBellActive = async (id, active) => {
    try {
      await api.timetable.updateBellSchedule(id, { active: !active });
      showSuccess(!active ? 'Bell schedule enabled' : 'Bell schedule disabled');
      await load();
    } catch (error) { showError(error.message || 'Could not toggle bell schedule'); }
  };

  const togglePeriodType = async (periodId, currentType) => {
    // Cycle: LESSON → BREAK → LESSON
    const nextType = currentType === 'LESSON' ? 'BREAK' : 'LESSON';
    const instructional = nextType === 'LESSON';
    try { await api.timetable.updateBellPeriod(periodId, { type: nextType, instructional }); await load(); }
    catch (error) { showError(error.message || 'Could not update period type'); }
  };

  const renamePeriod = async (periodId, name) => {
    try { await api.timetable.updateBellPeriod(periodId, { name }); await load(); }
    catch (error) { showError(error.message || 'Could not rename period'); }
  };

  const handleSavePeriod = async (periodId, updateData, cascade) => {
    try {
      await api.timetable.updateBellPeriod(periodId, updateData, cascade);
      showSuccess(cascade ? 'Period updated and subsequent periods shifted' : 'Period updated');
      await load();
    } catch (error) {
      showError(error.message || 'Failed to update period');
      throw error;
    }
  };

  // ── Room helpers ──────────────────────────────────────────────────────────
  const toggleRoomActive = async (id, active) => {
    try {
      await api.timetable.updateRoom(id, { active: !active });
      showSuccess(!active ? 'Room enabled' : 'Room disabled');
      await load();
    } catch (error) { showError(error.message || 'Could not toggle room'); }
  };

  // ── Plan / version helpers ────────────────────────────────────────────────
  const generatePlan = async (versionId) => {
    setGeneratingVersion(versionId);
    setGeneration(null);
    try {
      const response = await api.timetable.generate(versionId, { maxDailyLessons: 9 });
      const result = response.data || response;
      setGeneration(result);
      if (result.stats?.hardConflicts) showError(`Generated with ${result.stats.hardConflicts} hard conflict(s)`);
      else showSuccess(`Generated ${result.stats?.generatedEntries || 0} lesson periods`);
    } catch (error) {
      showError(error.message || 'Automatic timetable generation failed');
    } finally { setGeneratingVersion(''); }
  };

  const publishPlan = async (versionId, planName) => {
    if (!window.confirm(`Publish "${planName}"?\n\nExisting class schedules for this term will be replaced and this version will go live.`)) return;
    setPublishingVersion(versionId);
    try {
      await api.timetable.publish(versionId);
      showSuccess(`${planName} is now live — class schedules updated.`);
      await load();
      if (versionsPanel) loadVersions(versionsPanel.planId);
    } catch (error) {
      showError(error.message || 'Publish failed');
    } finally { setPublishingVersion(''); }
  };

  const handleDeletePlan = async (planId, planName, isLive) => {
    const confirmMsg = isLive
      ? `Delete live plan "${planName}"?\n\nWARNING: This plan is currently live! Deleting it will also remove published class schedules for this term.`
      : `Delete plan "${planName}"?\n\nThis will permanently remove this plan and its draft versions.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.timetable.deletePlan(planId);
      showSuccess(`Plan "${planName}" deleted.`);
      if (versionsPanel?.planId === planId) setVersionsPanel(null);
      await load();
    } catch (error) {
      showError(error.message || 'Could not delete plan');
    }
  };

  const handleDeleteBellSchedule = async (id, name) => {
    if (!window.confirm(`Delete bell schedule "${name}"?\n\nThis will remove this schedule and its periods. It cannot be deleted if a timetable plan is using it.`)) return;
    try {
      await api.timetable.deleteBellSchedule(id);
      showSuccess(`Bell schedule "${name}" deleted.`);
      await load();
    } catch (error) {
      showError(error.message || 'Could not delete bell schedule');
    }
  };

  const handleDeleteRoom = async (id, name) => {
    if (!window.confirm(`Delete room "${name}"?`)) return;
    try {
      await api.timetable.deleteRoom(id);
      showSuccess(`Room "${name}" deleted.`);
      await load();
    } catch (error) {
      showError(error.message || 'Could not delete room');
    }
  };

  const handleSelectClass = (e) => {
    const classId = e.target.value;
    setSelectedClassId(classId);

    if (classId === 'CUSTOM' || !classId) {
      setSelectedClassIds([]);
      setRoom(prev => ({
        ...prev,
        code: prev.code || getNextRoomCode(data.rooms)
      }));
      return;
    }

    const foundClass = (classList || []).find(c => c.id === classId);
    if (foundClass) {
      setSelectedClassIds([foundClass.id]);
      setRoom(prev => ({
        ...prev,
        name: foundClass.name,
        code: prev.code || getNextRoomCode(data.rooms),
        capacity: foundClass.capacity || 40,
        type: 'CLASSROOM'
      }));
    }
  };

  const applyClassToForm = (c) => {
    setSelectedClassId(c.id);
    setSelectedClassIds([c.id]);
    setRoom(prev => ({
      ...prev,
      name: c.name,
      code: prev.code || getNextRoomCode(data.rooms),
      capacity: c.capacity || 40,
      type: 'CLASSROOM'
    }));
  };

  // Toggle individual class checkbox selection
  const toggleClassSelection = (classId) => {
    setSelectedClassIds(prev => {
      const exists = prev.includes(classId);
      const next = exists ? prev.filter(id => id !== classId) : [...prev, classId];
      if (next.length === 1) {
        const found = (classList || []).find(c => c.id === next[0]);
        if (found) {
          setSelectedClassId(found.id);
          setRoom(r => ({
            ...r,
            name: found.name,
            code: r.code || getNextRoomCode(data.rooms),
            capacity: found.capacity || 40,
            type: 'CLASSROOM'
          }));
        }
      } else if (next.length === 0) {
        setSelectedClassId('');
      } else {
        setSelectedClassId('MULTI');
      }
      return next;
    });
  };

  // Master toggle: Select All Active Classes
  const handleSelectAllActiveClasses = () => {
    const targets = unassignedClasses.length > 0 ? unassignedClasses : sortedClasses;
    const targetIds = targets.map(c => c.id);
    const allSelected = targetIds.length > 0 && targetIds.every(id => selectedClassIds.includes(id));

    if (allSelected) {
      setSelectedClassIds([]);
      setSelectedClassId('');
    } else {
      setSelectedClassIds(targetIds);
      setSelectedClassId('MULTI');
    }
  };

  // Bulk create rooms for selected checked classes
  const handleBulkCreateSelectedClasses = async () => {
    const targetClasses = (classList || []).filter(c => selectedClassIds.includes(c.id));
    if (!targetClasses.length) return;
    setBulkCreatingRooms(true);
    let createdCount = 0;
    const newlyCreated = [];

    try {
      for (const c of targetClasses) {
        const nextCode = getNextRoomCode([...(data.rooms || []), ...newlyCreated]);
        const payload = {
          name: c.name.trim(),
          code: nextCode,
          type: 'CLASSROOM',
          capacity: Number(c.capacity) || 40,
        };
        await api.timetable.createRoom(payload);
        newlyCreated.push(payload);
        createdCount++;
      }
      showSuccess(`Successfully created ${createdCount} classroom${createdCount !== 1 ? 's' : ''} from selected classes!`);
      await load();
      setSelectedClassIds([]);
      setSelectedClassId('');
      setClassDropdownOpen(false);
      setRoom({
        name: '',
        code: getNextRoomCode([...(data.rooms || []), ...newlyCreated]),
        type: 'CLASSROOM',
        capacity: 40
      });
    } catch (err) {
      showError(err.message || 'Failed to auto-create rooms from classes');
      await load();
    } finally {
      setBulkCreatingRooms(false);
    }
  };

  const handleBulkCreateFromClasses = async () => {
    if (!unassignedClasses.length) return;
    setBulkCreatingRooms(true);
    let createdCount = 0;
    const newlyCreated = [];

    try {
      for (const c of unassignedClasses) {
        const nextCode = getNextRoomCode([...(data.rooms || []), ...newlyCreated]);
        const payload = {
          name: c.name.trim(),
          code: nextCode,
          type: 'CLASSROOM',
          capacity: Number(c.capacity) || 40,
        };
        await api.timetable.createRoom(payload);
        newlyCreated.push(payload);
        createdCount++;
      }
      showSuccess(`Successfully created ${createdCount} classroom${createdCount !== 1 ? 's' : ''} from active classes!`);
      await load();
      setSelectedClassId('');
      setSelectedClassIds([]);
      setRoom({
        name: '',
        code: getNextRoomCode([...(data.rooms || []), ...newlyCreated]),
        type: 'CLASSROOM',
        capacity: 40
      });
    } catch (err) {
      showError(err.message || 'Failed to auto-create rooms from classes');
      await load();
    } finally {
      setBulkCreatingRooms(false);
    }
  };

  const handleDeleteAllocation = async (id, subjectName, grade) => {
    if (!window.confirm(`Delete allocation for ${grade} ${subjectName}?`)) return;
    try {
      await api.timetable.deleteAllocation(id);
      showSuccess('Allocation deleted.');
      await load();
    } catch (error) {
      showError(error.message || 'Could not delete allocation');
    }
  };

  const handleClearAllocations = async () => {
    if (!window.confirm(`Clear ALL ${data.allocations.length} instructional allocations?\n\nThis will remove all target period rules across all grades.`)) return;
    try {
      const res = await api.timetable.clearAllocations();
      showSuccess(`Cleared ${res?.count || 0} allocations.`);
      await load();
    } catch (error) {
      showError(error.message || 'Could not clear allocations');
    }
  };

  const handleSeedAllocations = async (targetGrade) => {
    const isAll = !targetGrade || targetGrade === 'ALL';
    const activeAreas = (learningAreaList && learningAreaList.length > 0) ? learningAreaList : (learningAreas || []);
    if (!activeAreas.length) {
      showError('No learning areas available to seed. Please ensure subjects are configured.');
      return;
    }

    const norm = (s) => String(s || '').toUpperCase().replace(/[\s_-]+/g, '');
    const currentYearNum = Number(allocation.academicYear);

    // Determine target grades to seed
    let gradesToSeed = [];
    if (isAll) {
      gradesToSeed = availableGrades.map(g => g.value);
    } else {
      gradesToSeed = [targetGrade];
    }

    const itemsToSeed = [];
    for (const g of gradesToSeed) {
      const normG = norm(g);
      let matched = activeAreas.filter(a => a.gradeLevel && norm(a.gradeLevel) === normG);
      if (matched.length === 0) {
        matched = activeAreas.filter(a => !a.gradeLevel);
      }
      if (matched.length === 0 && !isAll) {
        matched = activeAreas;
      }
      for (const area of matched) {
        itemsToSeed.push({
          academicYear: currentYearNum,
          grade: g,
          learningAreaId: area.id,
          targetWeeklyPeriods: 5,
        });
      }
    }

    if (itemsToSeed.length === 0) {
      showError('No matching subjects found to seed.');
      return;
    }

    const gradeLabel = isAll ? `all ${gradesToSeed.length} grades` : (getGradeLabel(targetGrade) || targetGrade);
    const confirmed = window.confirm(
      `Seed ${itemsToSeed.length} subject allocation(s) for ${gradeLabel} at 5 periods/week (Year ${currentYearNum})?\n\nExisting allocations will be set to 5 periods/week. You can adjust individual subjects anytime.`
    );
    if (!confirmed) return;

    const saveKey = `seed-${targetGrade || 'ALL'}`;
    setSaving(saveKey);
    try {
      const BATCH_SIZE = 8;
      for (let i = 0; i < itemsToSeed.length; i += BATCH_SIZE) {
        const batch = itemsToSeed.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(item => api.timetable.saveAllocation(item)));
      }
      showSuccess(`Successfully seeded ${itemsToSeed.length} allocations at 5 periods/week!`);
      await load();
    } catch (error) {
      showError(error.message || 'Failed to seed allocations');
    } finally {
      setSaving('');
    }
  };

  const handleClearGradeAllocations = async (targetGrade) => {
    const label = formatGradeName(targetGrade);
    const count = allocationsByGrade[targetGrade]?.length || 0;
    if (!window.confirm(`Clear all ${count} allocations for ${label}?\n\nThis will remove target period rules for this grade only.`)) return;
    try {
      await api.timetable.clearAllocations({ grade: targetGrade });
      showSuccess(`Cleared ${count} allocations for ${label}.`);
      await load();
    } catch (error) {
      showError(error.message || `Could not clear allocations for ${label}`);
    }
  };

  const handleSeedRemainingGrades = async () => {
    if (allocationMetrics.unallocatedCount === 0) {
      showSuccess('All school grades are already allocated!');
      return;
    }
    const unallocated = allocationMetrics.unallocatedSchoolGrades;
    const confirmed = window.confirm(
      `Seed 5 periods/week for the ${unallocated.length} unallocated grade(s) (${unallocated.map(formatGradeName).join(', ')}) in ${allocation.academicYear}?`
    );
    if (!confirmed) return;

    setSaving('seed-remaining');
    try {
      const activeAreas = (learningAreaList && learningAreaList.length > 0) ? learningAreaList : (learningAreas || []);
      const norm = (s) => String(s || '').toUpperCase().replace(/[\s_-]+/g, '');
      const currentYearNum = Number(allocation.academicYear);
      const itemsToSeed = [];

      for (const g of unallocated) {
        const normG = norm(g);
        let matched = activeAreas.filter(a => a.gradeLevel && norm(a.gradeLevel) === normG);
        if (matched.length === 0) matched = activeAreas.filter(a => !a.gradeLevel);
        if (matched.length === 0) matched = activeAreas;

        for (const area of matched) {
          itemsToSeed.push({
            academicYear: currentYearNum,
            grade: g,
            learningAreaId: area.id,
            targetWeeklyPeriods: 5,
          });
        }
      }

      if (itemsToSeed.length === 0) {
        showError('No matching subjects found to seed for unallocated grades.');
        return;
      }

      const BATCH_SIZE = 8;
      for (let i = 0; i < itemsToSeed.length; i += BATCH_SIZE) {
        const batch = itemsToSeed.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(item => api.timetable.saveAllocation(item)));
      }
      showSuccess(`Successfully seeded ${itemsToSeed.length} allocations for ${unallocated.length} grade(s)!`);
      await load();
    } catch (error) {
      showError(error.message || 'Failed to seed remaining grades');
    } finally {
      setSaving('');
    }
  };

  const handleDeleteAvailability = async (id, teacherName) => {
    if (!window.confirm(`Delete availability rule for ${teacherName}?`)) return;
    try {
      await api.timetable.deleteTeacherAvailability(id);
      showSuccess('Availability rule deleted.');
      await load();
    } catch (error) {
      showError(error.message || 'Could not delete availability rule');
    }
  };

  const handleMasterReset = async () => {
    const confirmation = window.prompt(
      'MASTER RESET: This will completely wipe all timetable plans, versions, and live schedules.\n\nType "RESET" to confirm:'
    );
    if (confirmation !== 'RESET') {
      if (confirmation !== null) showError('Reset cancelled. You must type "RESET" to confirm.');
      return;
    }
    const wipeFoundation = window.confirm(
      'Do you also want to wipe instructional allocations, rooms, and availability rules to start 100% from zero?\n\nClick OK to wipe everything (Full Fresh Start), or Cancel to only wipe timetables & plans.'
    );
    try {
      setLoading(true);
      await api.timetable.masterReset({
        confirm: 'RESET-TIMETABLE-DATA',
        wipeLiveSchedules: true,
        wipePlans: true,
        wipeAllocations: wipeFoundation,
        wipeRooms: wipeFoundation,
        wipeAvailability: wipeFoundation,
        wipeBellSchedules: false, // keep bell schedules so periods are ready
      });
      showSuccess('Master reset complete. Timetable engine is clean and ready for fresh setup.');
      await load();
    } catch (error) {
      showError(error.message || 'Master reset failed');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (planId) => {
    setVersionsLoading(true);
    try {
      const response = await api.timetable.listVersions(planId);
      const versions = response.data || response || [];
      setVersionsPanel({ planId, versions });
    } catch (error) {
      showError(error.message || 'Could not load versions');
    } finally { setVersionsLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true" aria-label="Timetable engine setup">
      <div className={`w-full ${isFullScreen ? 'max-w-none' : 'max-w-5xl'} h-full bg-[#f6f8fc] shadow-2xl flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Kenya CBE Timetabling Engine</p>
            <h2 className="text-xl font-semibold text-gray-900">Timetable foundation</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(prev => !prev)}
              className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              title={isFullScreen ? 'Standard width (drawer)' : 'Full screen width'}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900"><X size={19} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 sm:px-7 bg-white border-b border-gray-200 overflow-x-auto flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setSection(id)}
              className={`px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap ${section === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div> : (
            <>
              {/* ── Overview ── */}
              {section === 'overview' && (
                <div className="space-y-5">
                  {/* Walkthrough */}
                  <TimetableWalkthrough
                    onNavigateTab={(tab) => setSection(tab)}
                    data={data}
                    subjectAssignmentCount={subjectAssignmentCount}
                    allTeachersAvailable={allTeachersAvailable}
                    onToggleAllTeachersAvailable={handleToggleAllTeachersAvailable}
                  />

                  {/* Academic Calendar Milestones & Planner Widget */}
                  {calendarMilestones && (
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-5 border border-indigo-700/50 shadow-md">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-800/80 pb-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-700/80 flex items-center justify-center text-amber-300">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base">Academic Calendar & Term Milestones</h3>
                              <span className="text-[10px] font-bold bg-indigo-600 text-indigo-100 px-2 py-0.5 rounded-full uppercase">
                                Synced with Annual Planner
                              </span>
                            </div>
                            <p className="text-xs text-indigo-200 mt-0.5">
                              Public holidays, midterm recesses, and exam dates defined in the Annual Planner automatically overlay on the timetable.
                            </p>
                          </div>
                        </div>
                        <a
                          href="/planner"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-200 hover:text-white bg-indigo-800/60 hover:bg-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-700 transition self-start sm:self-auto"
                        >
                          <span>Open Annual Planner</span>
                          <ExternalLink size={13} />
                        </a>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="bg-indigo-950/60 border border-indigo-800/40 rounded-lg p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Official Term Dates</span>
                          <p className="text-sm font-semibold text-white mt-1">
                            {calendarMilestones.summary?.termOpeningDate ? new Date(calendarMilestones.summary.termOpeningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Jan 6'}
                            {' — '}
                            {calendarMilestones.summary?.termClosingDate ? new Date(calendarMilestones.summary.termClosingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Apr 4'}
                          </p>
                          <p className="text-[10px] text-indigo-300 mt-0.5">Active Teaching Window</p>
                        </div>

                        <div className="bg-indigo-950/60 border border-indigo-800/40 rounded-lg p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Public Holidays</span>
                          <p className="text-sm font-semibold text-white mt-1">
                            {calendarMilestones.summary?.totalHolidays || 0} Registered Holidays
                          </p>
                          <p className="text-[10px] text-indigo-300 mt-0.5">Classes automatically suspended</p>
                        </div>

                        <div className="bg-indigo-950/60 border border-indigo-800/40 rounded-lg p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Assessment Blocks</span>
                          <p className="text-sm font-semibold text-white mt-1">
                            {calendarMilestones.summary?.examEventsCount || 0} Examination Week(s)
                          </p>
                          <p className="text-[10px] text-indigo-300 mt-0.5">Replaced by invigilation matrix</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <Metric icon={Clock3}       label="Bell schedules"   value={data.bellSchedules.length} tone="bg-indigo-50 text-indigo-600" />
                    <Metric icon={Building2}    label="Managed rooms"    value={data.rooms.length}         tone="bg-amber-50 text-amber-600" />
                    <Metric icon={BookOpenCheck} label="Allocations"     value={data.allocations.length}   tone="bg-emerald-50 text-emerald-600" />
                    <Metric icon={Users}        label="Availability rules" value={data.availability.length} tone="bg-cyan-50 text-cyan-600" />
                    <Metric icon={CalendarClock} label="Timetable plans" value={data.plans.length}         tone="bg-rose-50 text-rose-600" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex gap-3">
                      <ShieldCheck className="text-emerald-600 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-gray-900">Compatibility mode is active</h3>
                        <p className="text-sm text-gray-500 mt-1">Draft plans use normalized, versioned entries. Publishing projects the approved version into the existing class schedule so teacher, student and dashboard views continue to work. Manual overrides made via the Timetable page are preserved until the next publish.</p>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-rose-900 flex items-center gap-2"><RotateCcw size={16} /> Master Reset</h3>
                        <p className="text-sm text-rose-700 mt-1">Wipe all timetable plans, versions, and live schedules. Optionally also clear rooms, allocations, and teacher availability to start completely fresh.</p>
                      </div>
                      <button
                        onClick={handleMasterReset}
                        disabled={loading}
                        className="shrink-0 h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 flex items-center gap-2 transition-colors"
                      >
                        <RotateCcw size={15} />
                        Master Reset
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Bell schedules ── */}
              {section === 'bells' && (
                <div className="space-y-5">
                  {/* Next-step banner when schedules exist */}
                  {data.bellSchedules.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-950">Bell Schedule Ready ({data.bellSchedules.length} active)</p>
                          <p className="text-[11px] text-emerald-700">Next step: Define weekly lesson allocations per grade and subject.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSection('allocations')}
                        className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                      >
                        Next: Set Allocations <span className="text-sm">→</span>
                      </button>
                    </div>
                  )}
                  <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                  {/* Create form */}
                  <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
                    onSubmit={e => { e.preventDefault(); submit('bell', () => api.timetable.createBellSchedule({ name: bell.name, isDefault: bell.isDefault, periods: { create: buildPeriods(bell.startTime, Number(bell.duration), Number(bell.count)) } })); }}>
                    <h3 className="font-semibold text-gray-900">Create bell schedule</h3>
                    
                    {/* Quick Presets */}
                    <div>
                      <label className={labelClass}>Quick Presets by School Level</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SCHEDULE_PRESETS.map(p => {
                          const isMatch = Number(bell.duration) === p.duration && Number(bell.count) === p.count;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setBell(prev => ({ ...prev, name: p.name, duration: p.duration, count: p.count, startTime: p.startTime }))}
                              className={`p-2 rounded-lg border text-left transition-all ${
                                isMatch
                                  ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-400 font-semibold'
                                  : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 text-gray-700'
                              }`}
                            >
                              <p className="text-[11px] font-bold leading-tight truncate">{p.label}</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">{p.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div><label className={labelClass}>Schedule name</label><input className={fieldClass} value={bell.name} onChange={e => setBell({ ...bell, name: e.target.value })} required /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className={labelClass}>Starts</label><input type="time" className={fieldClass} value={bell.startTime} onChange={e => setBell({ ...bell, startTime: e.target.value })} /></div>
                      <div><label className={labelClass}>Minutes/period</label><input type="number" min="20" className={fieldClass} value={bell.duration} onChange={e => setBell({ ...bell, duration: e.target.value })} /></div>
                      <div><label className={labelClass}>No. of periods</label><input type="number" min="1" max="20" className={fieldClass} value={bell.count} onChange={e => setBell({ ...bell, count: e.target.value })} /></div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={bell.isDefault} onChange={e => setBell({ ...bell, isDefault: e.target.checked })} /> Make default</label>
                    <p className="text-[11px] text-gray-400">All periods are created as lessons. Click the pencil icon on any period chip below to customize duration with cascade shift or toggle it as a break.</p>
                    <button disabled={!canEdit || saving === 'bell'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{saving === 'bell' ? 'Saving…' : 'Create schedule'}</button>
                  </form>

                  {/* Existing schedules */}
                  <div className="space-y-4">
                    {data.bellSchedules.map(item => (
                      <div key={item.id} className={`bg-white border rounded-xl p-4 ${!item.active ? 'opacity-60' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <InlineEdit value={item.name} disabled={!canEdit} onSave={name => renameBellSchedule(item.id, name)} />
                            <p className="text-xs text-gray-500 mt-0.5">{item.periods.length} periods</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.isDefault
                              ? <span className="text-[10px] uppercase font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2 py-1">Default</span>
                              : canEdit && item.active && <button onClick={() => toggleBellDefault(item.id, item.isDefault)} className="text-[10px] font-semibold text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-full px-2 py-1">Set default</button>}
                            {canEdit && (
                              <button onClick={() => toggleBellActive(item.id, item.active)}
                                className={`text-[10px] font-semibold rounded-full px-2 py-1 border ${item.active ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-rose-50 hover:text-rose-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                                {item.active ? 'Disable' : 'Enable'}
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteBellSchedule(item.id, item.name)}
                                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                                title="Delete bell schedule"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Periods list with editable type and timing popup */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.periods.map(period => {
                            const isBreak = period.type === 'BREAK' || period.type === 'LUNCH';
                            const isReg   = period.type === 'REGISTRATION' || period.type === 'ASSEMBLY';
                            return (
                            <div key={period.id} className={`group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all border ${
                              isBreak
                                ? 'bg-amber-50 border-amber-200 shadow-sm'
                                : isReg
                                ? 'bg-cyan-50 border-cyan-200'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                            }`}>
                              {isBreak && <span className="text-base leading-none">{period.type === 'LUNCH' ? '🍽️' : '☕'}</span>}
                              {isReg   && <span className="text-base leading-none">✨</span>}
                              <span className={`font-medium ${
                                isBreak ? 'text-[11px] font-extrabold text-amber-900 uppercase tracking-wide' :
                                isReg   ? 'text-[10px] font-bold text-cyan-800 uppercase tracking-wide' :
                                'text-[10px] text-gray-800'
                              }`}>
                                {period.name}
                              </span>
                              <span className={`font-mono text-[9px] ${
                                isBreak ? 'text-amber-600' : isReg ? 'text-cyan-600' : 'text-gray-400'
                              }`}>{period.startTime}–{period.endTime}</span>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => setEditingPeriod({ ...period, scheduleName: item.name })}
                                  className="text-gray-400 hover:text-indigo-600 p-0.5 rounded hover:bg-white transition-colors"
                                  title="Edit timing, name & cascade shift"
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                              {canEdit ? (
                                <button
                                  title={`Click to quick-toggle type (currently ${period.type})`}
                                  onClick={() => togglePeriodType(period.id, period.type)}
                                  className={`text-[9px] font-bold uppercase rounded-md px-1.5 py-0.5 border transition-all ${
                                    isBreak
                                      ? 'bg-amber-400 text-white border-amber-500 hover:bg-amber-500 shadow-sm'
                                      : isReg
                                      ? 'bg-cyan-500 text-white border-cyan-600 hover:bg-cyan-600'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                  }`}>
                                  {period.type.slice(0, 4)}
                                </button>
                              ) : (
                                period.type !== 'LESSON' && (
                                  <span className={`text-[9px] font-bold uppercase rounded-md px-1.5 py-0.5 border ${
                                    isBreak ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                    isReg   ? 'bg-cyan-100 text-cyan-700 border-cyan-300' :
                                    'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  }`}>
                                    {period.type.slice(0, 4)}
                                  </span>
                                )
                              )}
                            </div>
                          )})}
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              )}

              {/* ── Rooms ── */}
              {section === 'rooms' && (
                <div className="space-y-5">
                  {/* Smart Classrooms Auto-Detection Banner */}
                  {unassignedClasses.length > 0 ? (
                    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-4 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-gray-900">
                                {unassignedClasses.length} Active {unassignedClasses.length === 1 ? 'Class' : 'Classes'} Detected Without Rooms
                              </h4>
                              <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                Auto-sync ready
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Auto-create classrooms for all registered classes at once, or select any class below to register individually.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleBulkCreateFromClasses}
                            disabled={bulkCreatingRooms || !canEdit}
                            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                          >
                            {bulkCreatingRooms ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Generating {unassignedClasses.length} Rooms…</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} />
                                <span>Auto-Create All {unassignedClasses.length} Rooms</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quick chips */}
                      <div className="mt-3 pt-3 border-t border-indigo-100/80 flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-[11px] font-medium text-gray-500">Quick Fill:</span>
                        {unassignedClasses.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => applyClassToForm(c)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                              selectedClassId === c.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            <Plus size={11} />
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : sortedClasses.length > 0 ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 font-medium">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>All {sortedClasses.length} active classes have timetable rooms configured.</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        {data.rooms.length} total facilities
                      </span>
                    </div>
                  ) : null}

                  <div className="grid lg:grid-cols-[380px_1fr] gap-5 items-start">
                    {/* Registration Form */}
                    <form
                      className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm"
                      onSubmit={e => {
                        e.preventDefault();
                        if (selectedClassIds.length > 1) {
                          handleBulkCreateSelectedClasses();
                          return;
                        }
                        const nextCode = room.code ? room.code.trim() : getNextRoomCode(data.rooms);
                        submit('room',
                          () => api.timetable.createRoom({
                            ...room,
                            code: nextCode,
                            capacity: Number(room.capacity) || 40
                          }),
                          () => {
                            setSelectedClassId('');
                            setSelectedClassIds([]);
                            setRoom({
                              name: '',
                              code: getNextRoomCode([...(data.rooms || []), { code: nextCode }]),
                              type: 'CLASSROOM',
                              capacity: 40
                            });
                          }
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">Register Room / Facility</h3>
                          <p className="text-[11px] text-gray-500 mt-0.5">Link active classes or add specialized facilities</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {data.rooms.length} Active
                        </span>
                      </div>

                      {/* Source Class Picker: Interactive Multi-Select Dropdown */}
                      <div className="relative" ref={classDropdownRef}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={labelClass}>Auto-Fetch From Active Class</label>
                          {(selectedClassId || selectedClassIds.length > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassId('');
                                setSelectedClassIds([]);
                                setRoom(r => ({ ...r, name: '', type: 'CLASSROOM' }));
                              }}
                              className="text-[10px] text-gray-400 hover:text-gray-600 font-medium"
                            >
                              Clear Selection
                            </button>
                          )}
                        </div>

                        {/* Dropdown Trigger */}
                        <button
                          type="button"
                          onClick={() => setClassDropdownOpen(prev => !prev)}
                          className={`w-full h-11 px-3 rounded-lg border text-sm flex items-center justify-between text-left transition-all ${
                            classDropdownOpen
                              ? 'border-indigo-500 ring-2 ring-indigo-100 bg-white'
                              : selectedClassIds.length > 0
                              ? 'border-indigo-300 bg-indigo-50/40'
                              : 'border-gray-200 bg-white hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 mr-2">
                            {selectedClassIds.length > 1 ? (
                              <>
                                <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] font-bold">
                                  {selectedClassIds.length} Selected
                                </span>
                                <span className="text-xs text-gray-700 truncate font-medium">
                                  {selectedClassNamesPreview}
                                </span>
                              </>
                            ) : selectedClassIds.length === 1 ? (
                              (() => {
                                const c = (classList || []).find(cls => cls.id === selectedClassIds[0]);
                                return (
                                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 truncate">
                                    <span className="text-amber-500">⭐</span>
                                    <span>{c?.name || '1 Class Selected'}</span>
                                    {c?.capacity && <span className="text-gray-400 font-normal">({c.capacity} cap)</span>}
                                  </span>
                                );
                              })()
                            ) : selectedClassId === 'CUSTOM' ? (
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                <span>✏️</span> Custom Facility (Lab, Library, Hall...)
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span>-- Choose active class(es) to auto-fill details --</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-gray-400">
                            {unassignedClasses.length > 0 && selectedClassIds.length === 0 && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                                {unassignedClasses.length} need rooms
                              </span>
                            )}
                            {classDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        {/* Interactive Dropdown Popover */}
                        {classDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            {/* Search & Master Select All Bar */}
                            <div className="p-2.5 bg-gray-50/90 border-b border-gray-200 space-y-2">
                              <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  value={classSearch}
                                  onChange={e => setClassSearch(e.target.value)}
                                  placeholder="Search active classes..."
                                  className="w-full h-8 pl-8 pr-7 rounded-lg border border-gray-200 bg-white text-xs placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                                />
                                {classSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setClassSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-xs px-1">
                                <button
                                  type="button"
                                  onClick={handleSelectAllActiveClasses}
                                  className="flex items-center gap-1.5 font-semibold text-indigo-700 hover:text-indigo-900 transition-colors"
                                >
                                  {areAllUnassignedSelected ? (
                                    <CheckSquare size={15} className="text-indigo-600" />
                                  ) : (
                                    <Square size={15} className="text-gray-400 hover:text-indigo-500" />
                                  )}
                                  <span>Select All Active Classes ({unassignedClasses.length})</span>
                                </button>

                                {selectedClassIds.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClassIds([]);
                                      setSelectedClassId('');
                                    }}
                                    className="text-[11px] font-medium text-gray-500 hover:text-rose-600 transition-colors"
                                  >
                                    Clear ({selectedClassIds.length})
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Class Items List */}
                            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100/90 text-xs">
                              {/* Classes Needing Rooms */}
                              {filteredUnassigned.length > 0 && (
                                <div>
                                  <div className="px-3 py-1.5 bg-amber-50/70 text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center justify-between">
                                    <span>Classes Needing Rooms ({filteredUnassigned.length})</span>
                                    <span className="text-amber-700 font-medium">Pending</span>
                                  </div>
                                  {filteredUnassigned.map(c => {
                                    const isChecked = selectedClassIds.includes(c.id);
                                    return (
                                      <div
                                        key={c.id}
                                        onClick={() => toggleClassSelection(c.id)}
                                        className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                          isChecked ? 'bg-indigo-50/70' : 'hover:bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleClassSelection(c.id);
                                            }}
                                            className="text-indigo-600 shrink-0"
                                          >
                                            {isChecked ? <CheckSquare size={15} /> : <Square size={15} className="text-gray-300" />}
                                          </button>
                                          <div className="truncate">
                                            <span className="font-semibold text-gray-900">{c.name}</span>
                                            {c.capacity && (
                                              <span className="text-[11px] text-gray-500 ml-1.5 font-normal">({c.capacity} cap)</span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                            <span>⭐</span> Needs Room
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              applyClassToForm(c);
                                              setClassDropdownOpen(false);
                                            }}
                                            title="Fill single room form with this class"
                                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline px-1.5 py-0.5"
                                          >
                                            Use
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Already Created Rooms */}
                              {filteredAssigned.length > 0 && (
                                <div>
                                  <div className="px-3 py-1.5 bg-gray-100/80 text-[10px] font-bold uppercase tracking-wider text-gray-600 flex items-center justify-between">
                                    <span>Already Created ({filteredAssigned.length})</span>
                                    <span className="text-emerald-600 font-semibold">Configured</span>
                                  </div>
                                  {filteredAssigned.map(c => {
                                    const isChecked = selectedClassIds.includes(c.id);
                                    return (
                                      <div
                                        key={c.id}
                                        onClick={() => toggleClassSelection(c.id)}
                                        className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                          isChecked ? 'bg-indigo-50/70' : 'hover:bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleClassSelection(c.id);
                                            }}
                                            className="text-indigo-600 shrink-0"
                                          >
                                            {isChecked ? <CheckSquare size={15} /> : <Square size={15} className="text-gray-300" />}
                                          </button>
                                          <div className="truncate">
                                            <span className="font-medium text-gray-700">{c.name}</span>
                                          </div>
                                        </div>
                                        <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                                          <Check size={10} /> Room exists
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Custom Facility Option */}
                              <div
                                onClick={() => {
                                  setSelectedClassId('CUSTOM');
                                  setSelectedClassIds([]);
                                  setRoom(r => ({ ...r, name: '', type: 'CLASSROOM', code: r.code || getNextRoomCode(data.rooms) }));
                                  setClassDropdownOpen(false);
                                }}
                                className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors ${
                                  selectedClassId === 'CUSTOM' ? 'bg-indigo-50 font-semibold text-indigo-900' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <span>✏️</span>
                                <div className="flex-1">
                                  <span className="font-medium">Custom Facility</span>
                                  <span className="text-[11px] text-gray-400 block">Lab, Library, Hall, Field, Office...</span>
                                </div>
                              </div>
                            </div>

                            {/* Dropdown Footer Action */}
                            <div className="p-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
                              <div className="text-[11px] text-gray-600 truncate">
                                {selectedClassIds.length > 0 ? (
                                  <span className="font-semibold text-indigo-700">{selectedClassIds.length} active class{selectedClassIds.length !== 1 ? 'es' : ''} selected</span>
                                ) : (
                                  <span>Select classes or pick one</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {selectedClassIds.length > 1 ? (
                                  <button
                                    type="button"
                                    disabled={bulkCreatingRooms || !canEdit}
                                    onClick={handleBulkCreateSelectedClasses}
                                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                                  >
                                    {bulkCreatingRooms ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin" />
                                        <span>Creating…</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles size={12} />
                                        <span>Create {selectedClassIds.length} Rooms</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setClassDropdownOpen(false)}
                                    className="h-8 px-3 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-semibold transition-colors"
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Multi-Selection Banner if > 1 selected */}
                      {selectedClassIds.length > 1 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-900">
                          <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">Bulk Mode: {selectedClassIds.length} Active Classes Selected</div>
                            <p className="text-[11px] text-indigo-700 mt-0.5">
                              Classrooms will be registered with names from selected classes and sequential auto-incremented codes (e.g. {room.code || getNextRoomCode(data.rooms)}, …).
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Room Name */}
                      <div>
                        <label className={labelClass}>Room / Facility Name</label>
                        {selectedClassIds.length > 1 ? (
                          <div className="w-full h-11 px-3 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs flex items-center text-indigo-800 font-medium">
                            Auto-filled from {selectedClassIds.length} selected classes ({selectedClassNamesPreview})
                          </div>
                        ) : (
                          <input
                            className={fieldClass}
                            value={room.name}
                            onChange={e => setRoom({ ...room, name: e.target.value })}
                            placeholder="e.g. Grade 1 East or Physics Lab"
                            required={selectedClassIds.length <= 1}
                          />
                        )}
                      </div>

                      {/* Code & Capacity */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className={labelClass}>{selectedClassIds.length > 1 ? 'Starting Code' : 'Room Code'}</label>
                            <button
                              type="button"
                              onClick={() => setRoom(r => ({ ...r, code: getNextRoomCode(data.rooms) }))}
                              title="Generate next available room code"
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
                            >
                              <RotateCcw size={9} />
                              Auto
                            </button>
                          </div>
                          <input
                            className={fieldClass}
                            value={room.code}
                            onChange={e => setRoom({ ...room, code: e.target.value })}
                            placeholder={getNextRoomCode(data.rooms)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Default Capacity</label>
                          <input
                            type="number"
                            min="1"
                            className={fieldClass}
                            value={room.capacity}
                            onChange={e => setRoom({ ...room, capacity: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Room Type */}
                      <div>
                        <label className={labelClass}>Facility Type</label>
                        <select
                          className={fieldClass}
                          value={room.type}
                          onChange={e => setRoom({ ...room, type: e.target.value })}
                        >
                          {ROOM_TYPES.map(type => (
                            <option key={type} value={type}>
                              {type.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={!canEdit || saving === 'room' || bulkCreatingRooms}
                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40"
                      >
                        {saving === 'room' || bulkCreatingRooms ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            <span>{bulkCreatingRooms ? `Generating ${selectedClassIds.length || unassignedClasses.length} Rooms…` : 'Adding Room…'}</span>
                          </>
                        ) : selectedClassIds.length > 1 ? (
                          <>
                            <Sparkles size={15} />
                            <span>Register {selectedClassIds.length} Selected Rooms (Auto-Codes)</span>
                          </>
                        ) : (
                          <>
                            <Plus size={15} />
                            <span>Add Room</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Room Directory */}
                    <div className="space-y-4">
                      {/* Search & Filter Toolbar */}
                      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="relative flex-1 max-w-sm">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search rooms or code..."
                            value={roomSearch}
                            onChange={e => setRoomSearch(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                          />
                        </div>

                        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg shrink-0 text-xs">
                          <button
                            type="button"
                            onClick={() => setRoomFilterType('ALL')}
                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                              roomFilterType === 'ALL'
                                ? 'bg-white text-gray-900 shadow-xs font-semibold'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            All ({data.rooms.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoomFilterType('CLASSROOM')}
                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                              roomFilterType === 'CLASSROOM'
                                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            Classrooms ({classroomCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoomFilterType('SPECIALIZED')}
                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                              roomFilterType === 'SPECIALIZED'
                                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            Specialized ({specializedCount})
                          </button>
                        </div>
                      </div>

                      {/* Room Cards Grid */}
                      {filteredRooms.length === 0 ? (
                        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                            <Building2 size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">
                              {roomSearch ? 'No matching rooms found' : 'No rooms registered yet'}
                            </h4>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                              {roomSearch
                                ? `No facilities match "${roomSearch}". Try clearing your search.`
                                : 'Use the auto-fetch options on the left to quickly register rooms from active classes.'}
                            </p>
                          </div>
                          {roomSearch && (
                            <button
                              type="button"
                              onClick={() => setRoomSearch('')}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              Clear Search
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {filteredRooms.map(item => {
                            const isClassroom = item.type === 'CLASSROOM';
                            return (
                              <div
                                key={item.id}
                                className={`bg-white border rounded-xl p-4 transition-all shadow-xs hover:shadow-sm ${
                                  !item.active ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                                        {item.code || '—'}
                                      </span>
                                      <span
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                          isClassroom
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                                        }`}
                                      >
                                        {item.type.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    <h4 className="font-semibold text-gray-900 text-sm truncate" title={item.name}>
                                      {item.name}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <span>Cap: {item.capacity || '—'}</span>
                                      <span>·</span>
                                      <span className={item.active ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                                        {item.active ? 'Active' : 'Disabled'}
                                      </span>
                                    </div>
                                  </div>

                                  {canEdit && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => toggleRoomActive(item.id, item.active)}
                                        className={`text-[10px] font-semibold rounded-full px-2 py-1 border transition-colors ${
                                          item.active
                                            ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                      >
                                        {item.active ? 'Disable' : 'Enable'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRoom(item.id, item.name)}
                                        className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center transition-colors"
                                        title="Delete room"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Allocations ── */}
              {section === 'allocations' && (
                <div className="space-y-5">
                  {/* Next-step banner */}
                  <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-violet-950">
                          {data.allocations.length > 0
                            ? `${data.allocations.length} allocation${data.allocations.length !== 1 ? 's' : ''} set — ready to create a plan`
                            : 'Set how many periods each subject needs per week'}
                        </p>
                        <p className="text-[11px] text-violet-700">Once you've added allocations, create a timetable plan to start scheduling.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('plans')}
                      className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                    >
                      Next: Create Plan <span className="text-sm">→</span>
                    </button>
                  </div>

                  {/* Quick Seed Card */}
                  {canEdit && (
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                          ⚡
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-amber-950">Quick Seed Allocations (5 periods / week)</p>
                            <span className="text-[10px] font-semibold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full">Fast Setup</span>
                          </div>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Auto-assigns 5 periods/week to standard subjects so you can edit individual values instead of adding them one by one.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          disabled={!canEdit || saving.startsWith('seed') || !allocation.grade}
                          onClick={() => handleSeedAllocations(allocation.grade)}
                          className="h-9 px-3.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                          title={`Seed 5 periods/week for ${getGradeLabel(allocation.grade) || allocation.grade} only`}
                        >
                          {saving === `seed-${allocation.grade}` ? <Loader2 size={13} className="animate-spin text-amber-600" /> : null}
                          Seed {getGradeLabel(allocation.grade) || allocation.grade} (5/wk)
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit || saving.startsWith('seed')}
                          onClick={() => handleSeedAllocations('ALL')}
                          className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                          title="Seed 5 periods/week across all active grades"
                        >
                          {saving === 'seed-ALL' ? <Loader2 size={13} className="animate-spin" /> : null}
                          ⚡ Seed All Grades (5/wk)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                  <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
                    onSubmit={e => { e.preventDefault(); submit('allocation', () => api.timetable.saveAllocation({ ...allocation, academicYear: Number(allocation.academicYear), targetWeeklyPeriods: Number(allocation.targetWeeklyPeriods) })); }}>
                    <h3 className="font-semibold text-gray-900">Weekly instructional allocation</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Year</label>
                        <select 
                          required 
                          className={fieldClass} 
                          value={allocation.academicYear} 
                          onChange={e => handleYearChange('allocation', e.target.value)}
                        >
                          {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                          <option value="__custom__">+ Enter other year…</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Grade</label>
                        <select 
                          required 
                          className={fieldClass} 
                          value={allocation.grade} 
                          onChange={e => setAllocation({ ...allocation, grade: e.target.value })}
                        >
                          <option value="">Select grade</option>
                          {availableGrades.map(g => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div><label className={labelClass}>Learning area</label>
                      <select required className={fieldClass} value={allocation.learningAreaId} onChange={e => setAllocation({ ...allocation, learningAreaId: e.target.value })}>
                        <option value="">Select learning area</option>
                        {filteredLearningAreas.map(area => (
                          <option key={area.id} value={area.id}>
                            {area.name} {area.gradeLevel && area.gradeLevel !== allocation.grade ? `(${getGradeLabel(area.gradeLevel) || area.gradeLevel})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div><label className={labelClass}>Target periods per week</label><input type="number" min="1" className={fieldClass} value={allocation.targetWeeklyPeriods} onChange={e => setAllocation({ ...allocation, targetWeeklyPeriods: e.target.value })} /></div>
                    <button disabled={!canEdit || saving === 'allocation'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Save allocation</button>
                  </form>
                  <div className="space-y-4">
                    {/* Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Allocated Grades</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xl font-bold text-gray-900">{allocationMetrics.allocatedCount}</span>
                          <span className="text-xs text-gray-400">/ {allocationMetrics.totalSchoolGrades} grades</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${allocationMetrics.totalSchoolGrades > 0 ? Math.min(100, Math.round((allocationMetrics.allocatedCount / allocationMetrics.totalSchoolGrades) * 100)) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className={`border rounded-xl p-3.5 shadow-sm ${allocationMetrics.unallocatedCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-gray-200'}`}>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Unallocated Grades</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className={`text-xl font-bold ${allocationMetrics.unallocatedCount > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                            {allocationMetrics.unallocatedCount}
                          </span>
                          <span className="text-xs text-gray-400">grades pending</span>
                        </div>
                        <p className="text-[10px] mt-2 font-medium text-gray-500">
                          {allocationMetrics.unallocatedCount > 0 ? 'Need setup before scheduling' : 'All active grades covered ✓'}
                        </p>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Subjects</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xl font-bold text-gray-900">{allocationMetrics.totalAllocatedSubjects}</span>
                          <span className="text-xs text-gray-400">allocations</span>
                        </div>
                        <p className="text-[10px] mt-2 text-gray-500">Across {allocationMetrics.allocatedCount} configured grades</p>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Weekly Periods</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xl font-bold text-indigo-600">{allocationMetrics.totalWeeklyPeriods}</span>
                          <span className="text-xs text-gray-400">periods / wk</span>
                        </div>
                        <p className="text-[10px] mt-2 text-gray-500">Required instructional load</p>
                      </div>
                    </div>

                    {/* Unallocated Grades Warning Banner with Quick Action */}
                    {allocationMetrics.unallocatedCount > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-amber-950">
                                {allocationMetrics.unallocatedCount} active school grade{allocationMetrics.unallocatedCount !== 1 ? 's' : ''} have no instructional allocations
                              </p>
                              <p className="text-[11px] text-amber-800 mt-0.5">
                                These grades will have 0 periods generated in the timetable until subjects are allocated.
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mr-1">Unallocated:</span>
                                {allocationMetrics.unallocatedSchoolGrades.map(g => (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={() => {
                                      setAllocation(prev => ({ ...prev, grade: g }));
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
                                    title={`Select ${formatGradeName(g)} in allocation form`}
                                  >
                                    <span>{formatGradeName(g)}</span>
                                    <span className="text-[10px] text-amber-600 font-bold">+</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {canEdit && (
                            <button
                              type="button"
                              disabled={saving.startsWith('seed')}
                              onClick={handleSeedRemainingGrades}
                              className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition shrink-0 self-start sm:self-center"
                            >
                              {saving === 'seed-remaining' ? <Loader2 size={12} className="animate-spin" /> : '⚡'}
                              Seed Remaining ({allocationMetrics.unallocatedCount})
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Grouped Allocations Card */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Filter & Control Bar */}
                      <div className="p-3.5 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-800">
                            Allocations by Grade ({displayedGradeGroups.length} shown)
                          </span>
                          {allocatedGrades.length > 1 && (
                            <select
                              value={allocationGradeFilter}
                              onChange={e => setAllocationGradeFilter(e.target.value)}
                              className="h-8 text-xs px-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            >
                              <option value="ALL">All grades ({allocationMetrics.allocatedCount})</option>
                              {allocatedGrades.map(g => (
                                <option key={g} value={g}>{formatGradeName(g)} ({allocationsByGrade[g]?.length || 0})</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search subjects…"
                              value={allocationSearch}
                              onChange={e => setAllocationSearch(e.target.value)}
                              className="h-8 pl-7 pr-2.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 w-36 sm:w-44"
                            />
                            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                          </div>

                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={expandAllGrades}
                              className="h-8 px-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                              title="Expand all grade sections"
                            >
                              Expand
                            </button>
                            <button
                              type="button"
                              onClick={collapseAllGrades}
                              className="h-8 px-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                              title="Collapse all grade sections"
                            >
                              Collapse
                            </button>
                          </div>

                          {canEdit && data.allocations.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllocations}
                              className="h-8 px-2.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                              title="Clear all allocations across all grades"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Grade Groups Accordion */}
                      {displayedGradeGroups.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-xs italic">
                          {data.allocations.length === 0
                            ? 'No instructional allocations configured yet. Click "Seed All Grades" above to get started!'
                            : 'No allocations match this filter.'}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {displayedGradeGroups.map(group => {
                            const isCollapsed = Boolean(collapsedGrades[group.grade]);
                            return (
                              <div key={group.grade} className="transition-colors">
                                {/* Grade Header */}
                                <div 
                                  className="px-4 py-3 bg-gray-50/50 hover:bg-indigo-50/30 flex items-center justify-between gap-3 cursor-pointer select-none transition"
                                  onClick={() => toggleGradeCollapse(group.grade)}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                      {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                                    </span>
                                    <h4 className="text-xs font-bold text-gray-900">
                                      {group.label}
                                    </h4>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-700">
                                      {group.items.length} subject{group.items.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                      {group.totalPeriods} periods / wk
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAllocation(prev => ({ ...prev, grade: group.grade }));
                                      }}
                                      className="h-6 px-2 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded transition flex items-center gap-1"
                                      title={`Add another subject to ${group.label}`}
                                    >
                                      <Plus size={10} /> Add
                                    </button>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleClearGradeAllocations(group.grade)}
                                        className="h-6 px-2 text-[10px] font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition"
                                        title={`Clear ${group.label} allocations`}
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Grade Subjects Table */}
                                {!isCollapsed && (
                                  <div className="bg-white border-t border-gray-100">
                                    <div className="grid grid-cols-[1fr_100px_60px] px-4 py-1.5 bg-gray-50/30 text-[10px] font-semibold uppercase text-gray-400 border-b border-gray-100">
                                      <span>Learning Area</span>
                                      <span>Periods</span>
                                      <span className="text-right">Action</span>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                      {group.items.map(item => (
                                        <div
                                          key={item.id}
                                          className="grid grid-cols-[1fr_100px_60px] px-4 py-2 text-xs hover:bg-indigo-50/20 transition items-center"
                                        >
                                          <span
                                            className="font-medium text-gray-800 cursor-pointer hover:text-indigo-600 transition"
                                            onClick={() => setAllocation({
                                              academicYear: item.academicYear || allocation.academicYear,
                                              grade: item.grade,
                                              learningAreaId: item.learningAreaId || item.learningArea?.id || '',
                                              targetWeeklyPeriods: item.targetWeeklyPeriods
                                            })}
                                            title="Click to edit allocation in form"
                                          >
                                            {item.learningArea?.name || '—'}
                                          </span>
                                          <div>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                              {item.targetWeeklyPeriods} / wk
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-end gap-1">
                                            {canEdit && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => setAllocation({
                                                    academicYear: item.academicYear || allocation.academicYear,
                                                    grade: item.grade,
                                                    learningAreaId: item.learningAreaId || item.learningArea?.id || '',
                                                    targetWeeklyPeriods: item.targetWeeklyPeriods
                                                  })}
                                                  className="w-6 h-6 rounded border border-gray-200 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition"
                                                  title="Edit in form"
                                                >
                                                  <Edit2 size={11} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteAllocation(item.id, item.learningArea?.name || '?', group.label)}
                                                  className="w-6 h-6 rounded border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                                                  title="Delete allocation"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* ── Availability ── */}
              {section === 'availability' && (() => {
                // Build per-teacher unavailability map from rules
                const unavailMap = {}; // teacherId -> Set of days
                data.availability.forEach(rule => {
                  if (!rule.available) {
                    if (!unavailMap[rule.teacher?.id || rule.teacherId]) unavailMap[rule.teacher?.id || rule.teacherId] = {};
                    unavailMap[rule.teacher?.id || rule.teacherId][rule.day] = rule;
                  }
                });
                const availableTeachers  = teachers.filter(t => !Object.keys(unavailMap[t.id] || {}).length);
                const restrictedTeachers = teachers.filter(t =>  Object.keys(unavailMap[t.id] || {}).length > 0);

                return (
                <div className="space-y-6">
                  {/* All Available Status & Confirmation Banner */}
                  <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm transition-all ${
                    allTeachersAvailable || (restrictedTeachers.length === 0 && teachers.length > 0)
                      ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-200'
                      : 'bg-gradient-to-r from-gray-50 to-indigo-50/40 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        allTeachersAvailable || (restrictedTeachers.length === 0 && teachers.length > 0)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}>
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900">
                            {restrictedTeachers.length === 0
                              ? `All ${teachers.length} Teachers Fully Available`
                              : `${availableTeachers.length} of ${teachers.length} Teachers Fully Available`}
                          </h4>
                          {(allTeachersAvailable || restrictedTeachers.length === 0) && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Marked Green in Guide
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {restrictedTeachers.length === 0
                            ? 'All staff members are available with no blocked windows. The engine will schedule lessons across all school periods.'
                            : `${restrictedTeachers.length} teacher(s) have blocked slots. The generator will avoid scheduling their lessons during these windows.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={openDeficitReport}
                        className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        title="View curriculum continuity audit — see how many lessons have been covered by non-specialists"
                      >
                        <BookOpenCheck size={14} />
                        <span className="hidden sm:inline">Continuity Audit</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleAllTeachersAvailable}
                        className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                          allTeachersAvailable
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        <span>{allTeachersAvailable ? '✓ All Marked Available' : 'Mark All as Available'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Teachers</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-gray-900">{teachers.length}</span>
                        <span className="text-xs text-gray-400">staff</span>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 shadow-sm">
                      <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Fully Available</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-emerald-700">{availableTeachers.length}</span>
                        <span className="text-xs text-emerald-500">teachers</span>
                      </div>
                    </div>
                    <div className={`rounded-xl p-3.5 shadow-sm border ${
                      restrictedTeachers.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-200'
                    }`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                        restrictedTeachers.length > 0 ? 'text-rose-700' : 'text-gray-500'
                      }`}>With Restrictions</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-2xl font-bold ${
                          restrictedTeachers.length > 0 ? 'text-rose-700' : 'text-gray-900'
                        }`}>{restrictedTeachers.length}</span>
                        <span className="text-xs text-gray-400">teachers</span>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Rules</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-indigo-600">{data.availability.length}</span>
                        <span className="text-xs text-gray-400">rules</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
                    {/* Left: Rule Form */}
                    <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm sticky top-4"
                      onSubmit={async e => {
                        e.preventDefault();
                        await submit('availability', () => api.timetable.saveTeacherAvailability(availability));
                        // If marking as UNAVAILABLE on a specific day, auto-check for orphaned lessons
                        if (!availability.available && availability.teacherId && availability.day) {
                          await checkAbsenceImpact(availability.teacherId, availability.day);
                        }
                      }}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                          <UserX size={16} className="text-rose-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">Mark unavailability rule</h3>
                      </div>
                      <div><label className={labelClass}>Teacher</label>
                        <select required className={fieldClass} value={availability.teacherId} onChange={e => setAvailability({ ...availability, teacherId: e.target.value })}>
                          <option value="">Select teacher</option>
                          {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}
                        </select>
                      </div>
                      <div><label className={labelClass}>Day</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                            <button key={day} type="button"
                              onClick={() => setAvailability(a => ({ ...a, day }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                availability.day === day
                                  ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              }`}>{day.slice(0,3)}</button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelClass}>From</label><input type="time" className={fieldClass} value={availability.startTime} onChange={e => setAvailability({ ...availability, startTime: e.target.value })} /></div>
                        <div><label className={labelClass}>To</label><input type="time" className={fieldClass} value={availability.endTime} onChange={e => setAvailability({ ...availability, endTime: e.target.value })} /></div>
                      </div>
                      <div><label className={labelClass}>Reason (optional)</label><input className={fieldClass} value={availability.reason} onChange={e => setAvailability({ ...availability, reason: e.target.value })} placeholder="e.g. Part-time, personal leave" /></div>
                      <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" className="rounded" checked={availability.available} onChange={e => setAvailability({ ...availability, available: e.target.checked })} />
                        <span>Mark as <span className="font-semibold text-emerald-600">Available</span> (override, not a block)</span>
                      </label>
                      <button disabled={!canEdit || !availability.teacherId || saving === 'availability'} className="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                        {saving === 'availability' ? <Loader2 size={15} className="animate-spin" /> : <UserX size={15} />}
                        Save rule
                      </button>
                    </form>

                    {/* Right: Teacher Roster Matrix */}
                    <div className="space-y-4">
                      {/* Restricted teachers */}
                      {restrictedTeachers.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                            <UserX size={15} className="text-rose-600" />
                            <h4 className="text-sm font-bold text-rose-900">Teachers with restrictions ({restrictedTeachers.length})</h4>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {restrictedTeachers.map(teacher => {
                              const dayRules = unavailMap[teacher.id] || {};
                              return (
                                <div key={teacher.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                    {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900">{teacher.firstName} {teacher.lastName}</p>
                                    <p className="text-[11px] text-gray-500">{teacher.subject || teacher.email || ''}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="flex flex-wrap gap-1.5 justify-end">
                                      {['Mon','Tue','Wed','Thu','Fri'].map((d, i) => {
                                        const fullDay = ['Monday','Tuesday','Wednesday','Thursday','Friday'][i];
                                        const rule = dayRules[fullDay];
                                        return rule ? (
                                          <div key={d} className="group relative">
                                            <button
                                              type="button"
                                              onClick={() => canEdit && handleDeleteAvailability(rule.id, `${teacher.firstName} ${teacher.lastName}`)}
                                              className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[10px] font-bold border border-rose-600 hover:bg-rose-700 transition flex items-center gap-1"
                                              title={`${fullDay}: ${rule.startTime}–${rule.endTime}${rule.reason ? ` (${rule.reason})` : ''} — click to remove`}
                                            >
                                              {d}
                                              {canEdit && <X size={8} className="opacity-70" />}
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            key={d}
                                            type="button"
                                            onClick={() => canEdit && setAvailability(a => ({ ...a, teacherId: teacher.id, day: fullDay, available: false }))}
                                            className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-medium border border-gray-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
                                            title={`Click to mark ${teacher.firstName} unavailable on ${fullDay}`}
                                          >
                                            {d}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {/* Relief Cover quick-trigger for restricted teacher */}
                                    <button
                                      type="button"
                                      onClick={() => checkAbsenceImpact(teacher.id, Object.keys(dayRules)[0] || 'Monday')}
                                      className="shrink-0 h-7 px-2.5 rounded-lg bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-200 hover:bg-orange-100 transition flex items-center gap-1"
                                      title="Open Relief Cover Workbench for this teacher"
                                    >
                                      <AlertTriangle size={10} /> Cover
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Fully available teachers */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserCheck size={15} className="text-emerald-600" />
                            <h4 className="text-sm font-bold text-emerald-900">Fully available teachers ({availableTeachers.length})</h4>
                          </div>
                          <p className="text-[11px] text-emerald-700">Click any day to mark unavailable</p>
                        </div>
                        {availableTeachers.length === 0 ? (
                          <p className="text-sm text-gray-400 p-4 text-center">All teachers have at least one restriction.</p>
                        ) : (
                          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                            {availableTeachers.map(teacher => (
                              <div key={teacher.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                  {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{teacher.firstName} {teacher.lastName}</p>
                                  <p className="text-[11px] text-gray-500">{teacher.subject || teacher.email || 'All days available'}</p>
                                </div>
                                <div className="flex gap-1.5">
                                  {['Mon','Tue','Wed','Thu','Fri'].map((d, i) => {
                                    const fullDay = ['Monday','Tuesday','Wednesday','Thursday','Friday'][i];
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => canEdit && setAvailability(a => ({ ...a, teacherId: teacher.id, day: fullDay, available: false }))}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
                                        title={`Mark ${teacher.firstName} unavailable on ${fullDay}`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Existing rules list */}
                      {data.availability.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <h4 className="text-sm font-bold text-gray-700">All availability rules ({data.availability.length})</h4>
                          </div>
                          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                            {data.availability.map(item => (
                              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50 transition">
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold text-gray-900">{item.teacher?.firstName} {item.teacher?.lastName}</span>
                                  <span className="ml-2 text-xs text-gray-500">{item.day} · {item.startTime}–{item.endTime}</span>
                                  {item.reason && <span className="ml-1 text-[11px] text-gray-400 italic">({item.reason})</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] uppercase font-bold rounded-full px-2.5 py-1 ${
                                    item.available ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {item.available ? '✓ Available' : '✗ Blocked'}
                                  </span>
                                  {canEdit && (
                                    <button
                                      onClick={() => handleDeleteAvailability(item.id, `${item.teacher?.firstName} ${item.teacher?.lastName}`)}
                                      className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                                      title="Delete rule"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* ── Plans ── */}
              {section === 'plans' && (
                editing
                  ? <TimetableDraftEditor
                      plan={editing.plan}
                      version={editing.version}
                      bellSchedule={data.bellSchedules.find(item => item.id === editing.plan.bellScheduleId)}
                      teachers={teachers}
                      rooms={data.rooms}
                      classes={classList}
                      availabilityRules={data.availability}
                      canEdit={canEdit && ['DRAFT', 'GENERATED', 'DEPARTMENT_REVIEW', 'DEPUTY_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED'].includes(editing.version.status)}
                      onChanged={load}
                      onBack={() => setEditing(null)}
                      onNavigateSection={(targetSection, prefill) => {
                        setEditing(null);
                        setSection(targetSection);
                        if (targetSection === 'availability' && prefill?.teacherId) {
                          setAvailability(prev => ({
                            ...prev,
                            teacherId: prefill.teacherId,
                            day: prefill.day || prev.day
                          }));
                        }
                      }}
                      isFullScreen={isFullScreen}
                      onToggleFullScreen={() => setIsFullScreen(prev => !prev)}
                    />
                  : <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                      {/* Create plan form */}
                      <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
                        onSubmit={e => { e.preventDefault(); submit('plan', () => api.timetable.createPlan({ ...plan, academicYear: Number(plan.academicYear) })); }}>
                        <h3 className="font-semibold text-gray-900">Create versioned timetable plan</h3>
                        <div><label className={labelClass}>Plan name</label><input className={fieldClass} value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Year</label>
                            <select 
                              required 
                              className={fieldClass} 
                              value={plan.academicYear} 
                              onChange={e => handleYearChange('plan', e.target.value)}
                            >
                              {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                              <option value="__custom__">+ Enter other year…</option>
                            </select>
                          </div>
                          <div><label className={labelClass}>Term</label>
                            <select className={fieldClass} value={plan.term} onChange={e => setPlan({ ...plan, term: e.target.value })}>
                              <option value="TERM_1">Term 1</option><option value="TERM_2">Term 2</option><option value="TERM_3">Term 3</option>
                            </select>
                          </div>
                        </div>
                        <div><label className={labelClass}>Bell schedule</label>
                          <select required className={fieldClass} value={plan.bellScheduleId} onChange={e => setPlan({ ...plan, bellScheduleId: e.target.value })}>
                            <option value="">Select schedule</option>
                            {data.bellSchedules.filter(b => b.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        <button disabled={!canEdit || saving === 'plan'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Create draft plan</button>
                      </form>

                      <div className="space-y-3">
                        {/* Generation result card */}
                        {generation && (
                          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div><h4 className="font-semibold text-gray-900">Generation result</h4><p className="text-xs text-gray-500 mt-1">Draft replaced; locked lessons preserved.</p></div>
                              {generation.stats?.hardConflicts ? <AlertTriangle className="text-rose-500" /> : <CheckCircle2 className="text-emerald-500" />}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[['Lessons', generation.stats?.generatedEntries], ['Classes', generation.stats?.classes], ['Unresolved', generation.stats?.unresolvedAllocations], ['Conflicts', generation.stats?.hardConflicts]].map(([label, value]) => (
                                <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                                  <p className="text-lg font-semibold text-gray-900">{value || 0}</p>
                                  <p className="text-[10px] uppercase font-semibold text-gray-500">{label}</p>
                                </div>
                              ))}
                            </div>
                            {!!generation.unresolved?.length && (
                              <div className="max-h-48 overflow-y-auto space-y-2">
                                {generation.unresolved.map(item => (
                                  <div key={`${item.classId}-${item.learningAreaId}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-xs font-semibold text-amber-900">{item.className} · {item.learningAreaName}</p>
                                    <p className="text-[11px] text-amber-700 mt-1">Scheduled {item.scheduledPeriods} of {item.requiredPeriods}. {item.reason}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Plan cards */}
                        {data.plans.map(item => {
                          const version = item.versions?.[0];
                          const editable = version && ['DRAFT', 'GENERATED', 'DEPARTMENT_REVIEW', 'DEPUTY_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED'].includes(version.status);
                          const isPublishable = canEdit && version?.status === 'APPROVED';
                          const isPublished   = version?.status === 'PUBLISHED';
                          const isLocked      = version?.status === 'LOCKED';
                          const isArchived    = version?.status === 'ARCHIVED';
                          const showVersions  = versionsPanel?.planId === item.id;

                          return (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-0">
                              <div className="flex justify-between gap-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{item.name}</h4>
                                  <p className="text-xs text-gray-500">{item.term.replace('_', ' ')} · {item.academicYear} · {item.bellSchedule.name}</p>
                                </div>
                                <span className={`text-[10px] uppercase font-semibold rounded-full px-2 py-1 h-fit ${versionBadgeCls(version?.status || item.status)}`}>
                                  {version?.status?.replaceAll('_', ' ') || item.status}
                                </span>
                              </div>

                              {version && (
                                <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                                  {/* Left — version info + all versions toggle */}
                                  <div className="flex items-center gap-2">
                                    <p className="text-[11px] text-gray-500">Version {version.version}</p>
                                    <button type="button"
                                      onClick={() => showVersions ? setVersionsPanel(null) : loadVersions(item.id)}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-indigo-600">
                                      <Layers size={12} />
                                      {showVersions ? 'Hide' : 'All versions'}
                                    </button>
                                  </div>

                                  {/* Right — action buttons */}
                                  <div className="flex gap-2 flex-wrap justify-end">
                                    <button type="button"
                                      onClick={() => setEditing({ plan: item, version })}
                                      className="h-9 px-3 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                                      {isPublished || isLocked || isArchived ? 'View grid' : 'Edit grid'}
                                    </button>
                                    {editable && !isPublishable && (
                                      <button type="button"
                                        disabled={!canEdit || generatingVersion === version.id}
                                        onClick={() => generatePlan(version.id)}
                                        className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40 hover:bg-indigo-700">
                                        {generatingVersion === version.id
                                          ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                                          : <><Play size={14} /> Generate</>}
                                      </button>
                                    )}
                                    {isPublishable && (
                                      <button type="button"
                                        disabled={publishingVersion === version.id}
                                        onClick={() => publishPlan(version.id, item.name)}
                                        className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40 hover:bg-emerald-700">
                                        {publishingVersion === version.id
                                          ? <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                                          : <><Upload size={14} /> Publish</>}
                                      </button>
                                    )}
                                    {isPublished && (
                                      <span className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                                        <CheckCircle2 size={14} /> Live
                                      </span>
                                    )}
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePlan(item.id, item.name, isPublished)}
                                        className="h-9 px-2.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                                        title={isPublished ? 'Delete plan (clears live schedules)' : 'Delete plan'}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* All versions panel */}
                              {showVersions && (
                                <div className="mt-3 border-t border-gray-100 pt-3">
                                  {versionsLoading
                                    ? <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" /> Loading versions…</div>
                                    : (
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Version history</p>
                                        {(versionsPanel?.versions || []).map(v => (
                                          <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                              <GitBranch size={12} className="text-gray-400" />
                                              <span className="text-xs font-semibold text-gray-800">v{v.version}</span>
                                              <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${versionBadgeCls(v.status)}`}>{v.status.replaceAll('_', ' ')}</span>
                                              {v.changeNote && <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{v.changeNote}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="text-[10px] text-gray-400">{v._count?.entries ?? 0} entries</span>
                                              <button type="button"
                                                onClick={() => setEditing({ plan: item, version: v })}
                                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800">
                                                {['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(v.status) ? 'View' : 'Edit'}
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Period edit popup modal */}
      {editingPeriod && (
        <PeriodEditModal
          period={editingPeriod}
          onClose={() => setEditingPeriod(null)}
          onSave={(changes, cascade) => handleSavePeriod(editingPeriod.id, changes, cascade)}
        />
      )}

      {/* Relief Cover Workbench Modal */}
      {reliefModal && (
        <ReliefCoverModal
          impact={reliefModal.impact}
          assigning={reliefAssigning}
          onClose={() => setReliefModal(null)}
          onAssign={handleAssignRelief}
          onBatchAutoAssign={handleBatchAutoAssign}
        />
      )}

      {/* Curriculum Continuity Audit Modal */}
      {deficitModal.open && (
        <CurriculumDeficitModal
          report={deficitModal.report}
          loading={deficitModal.loading}
          onClose={() => setDeficitModal({ open: false, report: null, loading: false })}
        />
      )}
    </div>
  );
};

export default TimetableEngineSetup;
