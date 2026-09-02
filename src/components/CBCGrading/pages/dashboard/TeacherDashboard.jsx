/**
 * Teacher Dashboard – Desktop Redesign
 * Senior UX modern SaaS educational workspace for teachers.
 * Clean, calm, high-trust palette: Slate neutrals · Deep Navy · Purposeful status tints
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  MessageSquare,
  RefreshCw,
  Users,
  TrendingUp,
  Zap,
  ArrowUpRight,
  BarChart2,
  Award,
  Play,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { GreetingToast } from './DashboardSummary';
import ClockInStatusWidget from '../../dashboard/widgets/teacher/ClockInStatusWidget';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const fmt = (v) => Number(v || 0).toLocaleString();
const pct = (v) => `${Math.round(Number(v || 0))}%`;
const fmtTime = (v) => { if (!v) return '--:--'; const t = String(v); return t.length >= 5 ? t.slice(0, 5) : t; };
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
};
const sessionLabel = (time) => {
  const h = Number(String(time || '').split(':')[0]);
  if (!Number.isFinite(h)) return 'Today';
  if (h < 12) return 'Morning';
  if (h < 16) return 'Afternoon';
  return 'Evening';
};
const iconMap = {
  attendance: CheckCircle2, marks: ClipboardList,
  notes: BookOpen, 'lesson-notes': BookOpen,
  message: MessageSquare, learners: Users,
};

/* ─── Skeleton ──────────────────────────────────────────────────────────────── */
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
);

/* ─── Mini sparkline bars (decorative) ─────────────────────────────────────── */
const SparkBars = ({ values = [60, 80, 50, 90, 70, 85, 75], color = '#475569', height = 24 }) => (
  <svg width={50} height={height} viewBox={`0 0 50 ${height}`} fill="none" className="shrink-0 opacity-40">
    {values.map((v, i) => {
      const barH = (v / 100) * height;
      return (
        <rect
          key={i}
          x={i * 7}
          y={height - barH}
          width={4}
          height={barH}
          rx={1.5}
          fill={color}
        />
      );
    })}
  </svg>
);

/* ─── Radial ring (attendance / progress) ───────────────────────────────────── */
const RadialRing = ({ value = 0, size = 44, stroke = 4, color = '#0f172a', bg = '#e2e8f0' }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ─── Section header ─────────────────────────────────────────────────────────── */
const SectionHeader = ({ title, action, icon: Icon }) => (
  <div className="flex items-center justify-between gap-3 mb-3.5">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={15} className="text-slate-500" />}
      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</p>
    </div>
    {action}
  </div>
);

/* ─── Stat Tile (top row) ────────────────────────────────────────────────────── */
const StatTile = ({ label, value, sub, icon: Icon, accent = '#0f172a', spark, onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-all duration-150 hover:border-slate-300 hover:shadow-sm focus:outline-none"
    style={{ minHeight: 114 }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-black text-slate-900 tracking-tight leading-none">
          {loading ? <span className="text-slate-300">···</span> : value}
        </p>
        {sub && <p className="mt-1.5 truncate text-xs font-medium text-slate-500">{sub}</p>}
      </div>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white"
      >
        <Icon size={17} />
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between">
      {spark && <SparkBars color={accent} />}
      <ArrowUpRight size={14} className="ml-auto text-slate-300 transition-colors group-hover:text-slate-900" />
    </div>
  </button>
);

/* ─── Class Card ─────────────────────────────────────────────────────────────── */
const ClassCard = ({ item, onNavigate }) => {
  const initials = String(item.name || '?').trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const rate = Number(item.attendanceRate || 0);
  return (
    <button
      type="button"
      onClick={() => onNavigate('teacher-learner-analysis')}
      className="group flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left transition-all duration-150 hover:border-slate-300 hover:shadow-sm focus:outline-none"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm bg-slate-900 text-white transition-transform duration-150 group-hover:scale-105"
      >
        {initials}
        {Number(item.pending || 0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-sm">
            {item.pending}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{fmt(item.learnerCount)} learners · {pct(rate)} attendance</p>
        {item.subjects?.length > 0 && (
          <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{item.subjects.join(' · ')}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <RadialRing value={rate} size={34} stroke={3} color="#0f172a" />
      </div>
    </button>
  );
};

/* ─── Assessment Row ──────────────────────────────────────────────────────────── */
const AssessmentRow = ({ assessment, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate('assess-summative-assessment')}
    className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/50 focus:outline-none"
  >
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
      <ClipboardList size={15} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-slate-900">{assessment.title}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {[assessment.subject, assessment.learnerName, assessment.grade].filter(Boolean).join(' · ')}
      </p>
    </div>
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
      {fmtDate(assessment.dueDate) || 'Pending'}
    </span>
  </button>
);

/* ─── Alert / Event Row ──────────────────────────────────────────────────────── */
const AlertRow = ({ item, type, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate(item.actionPage || (type === 'event' ? 'annual-planner' : 'teacher-learner-analysis'))}
    className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-150 focus:outline-none ${
      type === 'event'
        ? 'border-slate-200/90 bg-white hover:border-slate-300'
        : 'border-amber-200/80 bg-white hover:border-amber-300'
    }`}
  >
    {type === 'event'
      ? <Clock3 size={16} className="shrink-0 text-slate-600" />
      : <AlertTriangle size={16} className="shrink-0 text-amber-500" />}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-slate-900">{item.name || item.title}</p>
      <p className="truncate text-xs text-slate-500 mt-0.5">
        {type === 'event' ? `${fmtDate(item.date)} · ${item.type || 'Calendar'}` : item.issue}
      </p>
    </div>
    <ChevronRight size={15} className="shrink-0 text-slate-300 group-hover:text-slate-900 transition-colors" />
  </button>
);

/* ─── Quick Action Button ─────────────────────────────────────────────────────── */
const QuickAction = ({ action, onNavigate }) => {
  const Icon = iconMap[action.icon] || Zap;
  return (
    <button
      type="button"
      onClick={() => onNavigate(action.navigateTo)}
      className="group flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/60 focus:outline-none"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
        <Icon size={14} />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">{action.label}</span>
      {Number(action.count || 0) > 0 && (
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
          {fmt(action.count)}
        </span>
      )}
    </button>
  );
};

/* ─── Next Lesson Hero Card ───────────────────────────────────────────────────── */
const NextLessonCard = ({ lesson, onNavigate }) => {
  if (!lesson) return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
      <CalendarDays size={26} className="mb-2 text-slate-300" />
      <p className="text-xs font-semibold text-slate-400">No lessons scheduled today</p>
    </div>
  );
  return (
    <button
      type="button"
      onClick={() => onNavigate('planner-timetable')}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-slate-900 p-4 text-left text-white shadow-sm transition-all duration-150 hover:bg-slate-800 focus:outline-none"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
        <Play size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-bold text-white tracking-tight">{lesson.subject || 'No lesson scheduled'}</p>
          <span className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
            {sessionLabel(lesson.time)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-300">
          {fmtTime(lesson.time)}
          {lesson.endTime ? ` – ${fmtTime(lesson.endTime)}` : ''}
          {lesson.grade || lesson.className ? ` · ${lesson.grade || lesson.className}` : ''}
          {lesson.room ? ` · Room ${lesson.room}` : ''}
        </p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-white transition-colors">
          View full timetable →
        </p>
      </div>
    </button>
  );
};

/* ─── Next Action Card ────────────────────────────────────────────────────────── */
const NextActionCard = ({ action, onNavigate }) => {
  if (!action) return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5 text-center">
      <CheckCircle2 size={24} className="mb-2 text-emerald-400" />
      <p className="text-xs font-semibold text-slate-400">No urgent actions — all clear!</p>
    </div>
  );
  return (
    <button
      type="button"
      onClick={() => onNavigate(action.navigateTo)}
      className="group flex w-full items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/50 focus:outline-none"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
        <Bell size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{action.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{action.description}</p>
        <span className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">
          {action.actionLabel}
          <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
};

/* ─── Highlight Learner ───────────────────────────────────────────────────────── */
const HighlightLearner = ({ learner, rank }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs bg-slate-100 text-slate-700"
    >
      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉'}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-slate-900">{learner.name}</p>
      <p className="text-xs text-slate-500">{learner.grade} · {pct(learner.avgPercentage)}</p>
    </div>
    <TrendingUp size={14} className="shrink-0 text-emerald-600" />
  </div>
);

/* ─── Empty Panel ─────────────────────────────────────────────────────────────── */
const EmptyPanel = ({ icon: Icon, title }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
    <Icon size={24} className="mb-2 text-slate-300" />
    <p className="text-xs font-semibold text-slate-400">{title}</p>
  </div>
);

/* ─── Panel (padded card) ─────────────────────────────────────────────────────── */
const Panel = ({ children, className = '', title, icon, action }) => (
  <div className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${className}`}>
    {title && <SectionHeader title={title} icon={icon} action={action} />}
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
const TeacherDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);

  const loadMetrics = async () => {
    try {
      setRefreshing(true);
      setApiError(null);
      const response = await dashboardAPI.getTeacherMetrics('today');
      if (response.success) setMetrics(response.data);
      else setApiError(response.message || 'Failed to load teacher dashboard data.');
    } catch (err) {
      setApiError(err.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadMetrics(); }, [user?.id, user?.userId]); // eslint-disable-line

  const stats = metrics?.stats || {};
  const pendingWork = metrics?.pendingWork || {};
  const schedule = useMemo(() => metrics?.schedule || [], [metrics?.schedule]);
  const attendanceDue = useMemo(() => metrics?.attendanceDue || [], [metrics?.attendanceDue]);
  const assessmentsToMark = useMemo(() => metrics?.assessmentsToMark || [], [metrics?.assessmentsToMark]);
  const classes = useMemo(() => metrics?.myClasses || [], [metrics?.myClasses]);
  const learnerAlerts = useMemo(() => metrics?.learnersNeedingAttention || [], [metrics?.learnersNeedingAttention]);
  const topPerformers = useMemo(() => metrics?.topPerformers || [], [metrics?.topPerformers]);
  const recentActivity = useMemo(() => metrics?.recentActivity || [], [metrics?.recentActivity]);
  const upcomingEvents = useMemo(() => metrics?.upcomingEvents || [], [metrics?.upcomingEvents]);
  const quickActions = useMemo(() => metrics?.quickActions || [], [metrics?.quickActions]);
  const nextAction = metrics?.nextAction;

  const pendingAttendanceLearners = Number(pendingWork.pendingAttendanceLearners || 0);
  const attendanceRate = stats.analytics?.attendance ?? (
    Number(stats.myStudents || 0) > 0
      ? ((Number(stats.myStudents || 0) - pendingAttendanceLearners) / Number(stats.myStudents || 1)) * 100
      : 0
  );
  const nextLesson = schedule.find(i => i.status === 'in-progress') ||
    schedule.find(i => i.status === 'upcoming') || schedule[0] || null;

  /* ── Stat tiles data ─────────────────────────────────────── */
  const statTiles = [
    {
      label: 'My Learners',
      value: loading ? '—' : fmt(stats.myStudents),
      sub: 'Total enrolled',
      icon: Users,
      accent: '#0f172a',
      spark: true,
      onClick: () => onNavigate('teacher-learner-analysis'),
    },
    {
      label: 'Attendance Rate',
      value: loading ? '—' : pct(attendanceRate),
      sub: `${fmt(attendanceDue.length)} classes due`,
      icon: CheckCircle2,
      accent: '#059669',
      spark: true,
      onClick: () => onNavigate('attendance-daily'),
    },
    {
      label: 'Assessments',
      value: loading ? '—' : fmt(assessmentsToMark.length),
      sub: 'Awaiting grading',
      icon: ClipboardList,
      accent: '#6366f1',
      spark: false,
      onClick: () => onNavigate('assess-summative-assessment'),
    },
    {
      label: 'Messages',
      value: loading ? '—' : fmt(stats.messages),
      sub: 'Inbox updates',
      icon: MessageSquare,
      accent: '#0f172a',
      spark: false,
      onClick: () => onNavigate('communication'),
    },
  ];

  /* ── Default quick actions ────────────────────────────────── */
  const resolvedActions = (quickActions.length > 0 ? quickActions : [
    { id: 'attendance', label: 'Take Attendance', icon: 'attendance', navigateTo: 'attendance-daily' },
    { id: 'marks', label: 'Enter Marks', icon: 'marks', navigateTo: 'assess-summative-assessment' },
    { id: 'lesson-notes', label: 'Lesson Notes', icon: 'lesson-notes', navigateTo: 'learning-hub-lesson-plans' },
    { id: 'learners', label: 'Learners', icon: 'learners', navigateTo: 'teacher-learner-analysis' },
  ]).slice(0, 6);

  /* ── Error state ─────────────────────────────────────────── */
  if (apiError && !metrics && !loading) return (
    <div className="space-y-6 text-slate-900">
      <GreetingToast user={user} fallbackName="Teacher" description="Teacher Dashboard · Today's Classes" onNavigate={onNavigate} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
        <AlertTriangle size={32} className="mb-3 text-slate-400" />
        <h2 className="text-base font-bold text-slate-900">Teacher dashboard unavailable</h2>
        <p className="mt-1 text-xs text-slate-500">{apiError}</p>
        <button
          type="button" onClick={loadMetrics}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    </div>
  );

  /* ── Loading skeleton ─────────────────────────────────────── */
  if (loading && !metrics) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-[114px]" />)}
      </div>
      <div className="grid grid-cols-[1fr_1fr_22rem] gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 pb-12 text-slate-900">
      {/* Greeting Banner */}
      <GreetingToast user={user} fallbackName="Teacher" description="Teacher Dashboard · Today's Classes" onNavigate={onNavigate} />

      {/* Sync indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
          <RefreshCw size={12} className="animate-spin text-slate-600" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Updating dashboard…</p>
        </div>
      )}

      {/* ── Row 1: Stat tiles ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {statTiles.map(tile => (
          <StatTile key={tile.label} {...tile} loading={loading} />
        ))}
      </div>

      {/* ── Row 2: Main workspace ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">

        {/* LEFT MAIN COLUMN ───────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Next Lesson + Next Action */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Next Lesson */}
            <Panel
              title="Today's Timetable"
              icon={CalendarDays}
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('planner-timetable')}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition hover:border-slate-300"
                >
                  Full schedule <ChevronRight size={10} />
                </button>
              }
            >
              <NextLessonCard lesson={nextLesson} onNavigate={onNavigate} />
              {/* Remaining lessons list */}
              {schedule.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  {schedule.slice(1, 4).map((s, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{s.subject}</span>
                      <span className="shrink-0 text-[11px] text-slate-500 font-medium">{fmtTime(s.time)}</span>
                      <span className="shrink-0 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                        {sessionLabel(s.time)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Next Action */}
            <Panel
              title="Next Priority"
              icon={Bell}
              action={
                <button
                  type="button"
                  onClick={loadMetrics}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition hover:border-slate-300"
                >
                  <RefreshCw size={10} /> Refresh
                </button>
              }
            >
              <NextActionCard action={nextAction} onNavigate={onNavigate} />

              {/* Alerts & Events stacked */}
              {(learnerAlerts.length > 0 || upcomingEvents.length > 0) && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Alerts &amp; Events</p>
                  {learnerAlerts.slice(0, 2).map((a) => (
                    <AlertRow key={a.id} item={a} type="alert" onNavigate={onNavigate} />
                  ))}
                  {upcomingEvents.slice(0, 2).map((e) => (
                    <AlertRow key={e.id} item={e} type="event" onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* My Classes */}
          <Panel
            title="My Classes"
            icon={Users}
            action={
              <button
                type="button"
                onClick={() => onNavigate('teacher-learner-analysis')}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition hover:border-slate-300"
              >
                All classes <ChevronRight size={10} />
              </button>
            }
          >
            {classes.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {classes.slice(0, 6).map(c => <ClassCard key={c.id} item={c} onNavigate={onNavigate} />)}
              </div>
            ) : (
              <EmptyPanel icon={Users} title="No assigned classes yet" />
            )}
          </Panel>

          {/* Assessment Queue */}
          <Panel
            title="Assessment Queue"
            icon={ClipboardList}
            action={
              assessmentsToMark.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate('assess-summative-assessment')}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-slate-800"
                >
                  Grade queue <ArrowUpRight size={10} />
                </button>
              ) : null
            }
          >
            {assessmentsToMark.length > 0 ? (
              <div className="space-y-2">
                {assessmentsToMark.slice(0, 6).map((a) => (
                  <AssessmentRow key={a.id} assessment={a} onNavigate={onNavigate} />
                ))}
              </div>
            ) : (
              <EmptyPanel icon={ClipboardList} title="No assessment drafts — queue is clear" />
            )}
          </Panel>
        </div>

        {/* RIGHT SIDEBAR ────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Clock-in widget */}
          <ClockInStatusWidget user={user} onNavigate={onNavigate} />

          {/* Quick Actions */}
          <Panel title="Quick Actions" icon={Zap}>
            <div className="grid grid-cols-2 gap-2">
              {resolvedActions.map((a) => (
                <QuickAction key={a.id || a.label} action={a} onNavigate={onNavigate} />
              ))}
            </div>
          </Panel>

          {/* Top Performers */}
          {topPerformers.length > 0 && (
            <Panel title="Top Performers" icon={Award}>
              <div className="space-y-2">
                {topPerformers.slice(0, 3).map((l, i) => (
                  <HighlightLearner key={l.id} learner={l} rank={i} />
                ))}
              </div>
            </Panel>
          )}

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <Panel title="Recent Activity" icon={BarChart2}>
              <div className="space-y-2">
                {recentActivity.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{a.text}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 font-medium">{a.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Class Health Card */}
          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm border border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class Health</p>
                <p className="mt-1 text-2xl font-black text-white tracking-tight">{pct(attendanceRate)}</p>
                <p className="text-xs text-slate-400 font-medium">Avg Attendance</p>
              </div>
              <RadialRing
                value={Math.round(attendanceRate)}
                size={52}
                stroke={4}
                color="#ffffff"
                bg="rgba(255,255,255,0.15)"
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="text-center">
                <p className="text-base font-bold text-white">{fmt(assessmentsToMark.length)}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">To Mark</p>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-base font-bold text-white">{fmt(classes.length)}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Classes</p>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-base font-bold text-white">{fmt(stats.myStudents)}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Learners</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
