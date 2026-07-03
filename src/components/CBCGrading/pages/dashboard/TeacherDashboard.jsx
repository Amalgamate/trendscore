/**
 * Teacher Dashboard – Desktop Redesign
 * Modern SaaS card-based workspace for teachers.
 * Brand palette: Navy #06285a · Orange #ff7900 · Purple #030b82
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
  Star,
  ArrowUpRight,
  BarChart2,
  Award,
  Play,
  Dot,
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
  <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
);

/* ─── Mini sparkline bars (purely decorative) ───────────────────────────────── */
const SparkBars = ({ values = [60, 80, 50, 90, 70, 85, 75], color = '#ff7900', height = 28 }) => (
  <svg width={56} height={height} viewBox={`0 0 56 ${height}`} fill="none" className="shrink-0">
    {values.map((v, i) => {
      const barH = (v / 100) * height;
      return (
        <rect
          key={i}
          x={i * 8}
          y={height - barH}
          width={5}
          height={barH}
          rx={2}
          fill={color}
          opacity={0.6 + i * 0.04}
        />
      );
    })}
  </svg>
);

/* ─── Radial ring (attendance / progress) ───────────────────────────────────── */
const RadialRing = ({ value = 0, size = 56, stroke = 5, color = '#ff7900', bg = '#e2e8f0' }) => {
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
  <div className="flex items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-[#ff7900]" />}
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#06285a]">{title}</p>
    </div>
    {action}
  </div>
);

/* ─── Stat Tile (top row) ────────────────────────────────────────────────────── */
const StatTile = ({ label, value, sub, icon: Icon, accent, spark, onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-100 bg-white p-4 text-left transition-all duration-200 hover:border-[#ff7900]/40 hover:shadow-[0_4px_24px_rgba(255,121,0,0.10)] focus:outline-none"
    style={{ minHeight: 120 }}
  >
    {/* Accent stripe */}
    <div
      className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl transition-all duration-300 group-hover:w-[5px]"
      style={{ background: accent }}
    />
    <div className="flex items-start justify-between gap-2 pl-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-black text-[#06285a] leading-none">
          {loading ? <span className="text-slate-300">···</span> : value}
        </p>
        {sub && <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{sub}</p>}
      </div>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${accent}18` }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between pl-2">
      {spark && <SparkBars color={accent} />}
      <ArrowUpRight size={13} className="ml-auto text-slate-300 transition-colors group-hover:text-[#ff7900]" />
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
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left transition-all duration-200 hover:border-[#ff7900]/30 hover:bg-[#fff8f2]"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-sm text-white transition-transform duration-200 group-hover:scale-105"
        style={{ background: 'linear-gradient(135deg,#06285a 60%,#030b82)' }}
      >
        {initials}
        {Number(item.pending || 0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff7900] text-[8px] font-black text-white">
            {item.pending}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#06285a]">{item.name}</p>
        <p className="text-[11px] text-slate-500">{fmt(item.learnerCount)} learners · {pct(rate)} attendance</p>
        {item.subjects?.length > 0 && (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{item.subjects.join(' · ')}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <RadialRing value={rate} size={36} stroke={3} color="#ff7900" />
      </div>
    </button>
  );
};

/* ─── Assessment Row ──────────────────────────────────────────────────────────── */
const AssessmentRow = ({ assessment, index, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate('assess-summative-assessment')}
    className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left transition-all duration-200 hover:border-[#ff7900]/30"
  >
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: index % 2 ? '#ff7900' : '#06285a' }}
    >
      <ClipboardList size={14} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[#06285a]">{assessment.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">
        {[assessment.subject, assessment.learnerName, assessment.grade].filter(Boolean).join(' · ')}
      </p>
    </div>
    <span className="shrink-0 rounded-full border border-[#ff7900]/30 bg-[#fff8f2] px-2 py-0.5 text-[10px] font-black text-[#ff7900]">
      {fmtDate(assessment.dueDate) || 'Pending'}
    </span>
  </button>
);

/* ─── Alert / Event Row ──────────────────────────────────────────────────────── */
const AlertRow = ({ item, type, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate(item.actionPage || (type === 'event' ? 'annual-planner' : 'teacher-learner-analysis'))}
    className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
      type === 'event'
        ? 'border-[#ff7900]/20 bg-[#fff8f2] hover:border-[#ff7900]/50'
        : 'border-amber-100 bg-amber-50 hover:border-amber-300'
    }`}
  >
    {type === 'event'
      ? <Clock3 size={16} className="shrink-0 text-[#ff7900]" />
      : <AlertTriangle size={16} className="shrink-0 text-amber-500" />}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[#06285a]">{item.name || item.title}</p>
      <p className="truncate text-[11px] text-slate-500">
        {type === 'event' ? `${fmtDate(item.date)} · ${item.type || 'Calendar'}` : item.issue}
      </p>
    </div>
    <ChevronRight size={14} className="shrink-0 text-slate-300 group-hover:text-[#ff7900]" />
  </button>
);

/* ─── Quick Action Button ─────────────────────────────────────────────────────── */
const QuickAction = ({ action, index, onNavigate }) => {
  const Icon = iconMap[action.icon] || Zap;
  const isOrange = index % 2 === 1;
  return (
    <button
      type="button"
      onClick={() => onNavigate(action.navigateTo)}
      className="group flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition-all duration-200"
      style={{
        borderColor: isOrange ? '#ff7900' : 'rgba(6,40,90,0.15)',
        background: isOrange ? '#ff7900' : 'white',
        color: isOrange ? '#06285a' : '#06285a',
      }}
    >
      <Icon size={15} className="shrink-0" />
      <span className="truncate text-xs">{action.label}</span>
      {Number(action.count || 0) > 0 && (
        <span className="ml-auto shrink-0 rounded-full bg-white/30 px-1.5 py-0.5 text-[9px] font-black">
          {fmt(action.count)}
        </span>
      )}
    </button>
  );
};

/* ─── Next Lesson Hero Card ───────────────────────────────────────────────────── */
const NextLessonCard = ({ lesson, onNavigate }) => {
  if (!lesson) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
      <CalendarDays size={28} className="mb-2 text-slate-300" />
      <p className="text-sm font-semibold text-slate-400">No lessons scheduled today</p>
    </div>
  );
  return (
    <button
      type="button"
      onClick={() => onNavigate('planner-timetable')}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl p-4 text-left transition-all duration-200 hover:opacity-95"
      style={{ background: 'linear-gradient(135deg,#ff7900 0%,#e86a00 100%)' }}
    >
      {/* Decorative blob */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-4 -right-2 h-16 w-16 rounded-full bg-white/10" />

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Play size={20} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-black text-white">{lesson.subject || 'No lesson scheduled'}</p>
          <span className="shrink-0 rounded-md bg-white/25 px-2 py-0.5 text-[9px] font-black uppercase text-white">
            {sessionLabel(lesson.time)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] font-medium text-white/80">
          {fmtTime(lesson.time)}
          {lesson.endTime ? ` – ${fmtTime(lesson.endTime)}` : ''}
          {lesson.grade || lesson.className ? ` · ${lesson.grade || lesson.className}` : ''}
          {lesson.room ? ` · Room ${lesson.room}` : ''}
        </p>
        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-white/70">View timetable →</p>
      </div>
    </button>
  );
};

/* ─── Next Action Card ────────────────────────────────────────────────────────── */
const NextActionCard = ({ action, onNavigate }) => {
  if (!action) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
      <CheckCircle2 size={24} className="mb-2 text-emerald-300" />
      <p className="text-sm font-semibold text-slate-400">No urgent action — all clear!</p>
    </div>
  );
  return (
    <button
      type="button"
      onClick={() => onNavigate(action.navigateTo)}
      className="group flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 text-left transition-all duration-200 hover:border-[#06285a]/20 hover:bg-slate-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#06285a]/10">
        <Bell size={18} className="text-[#06285a]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#06285a]">{action.title}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{action.description}</p>
        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-[#ff7900]">{action.actionLabel}</p>
      </div>
      <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-[#ff7900] transition-colors" />
    </button>
  );
};

/* ─── Highlight Learner ───────────────────────────────────────────────────────── */
const HighlightLearner = ({ learner, rank }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-black text-xs text-white"
      style={{ background: rank === 0 ? '#ff7900' : rank === 1 ? '#06285a' : '#8b5cf6' }}
    >
      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉'}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-[#06285a]">{learner.name}</p>
      <p className="text-[11px] text-slate-500">{learner.grade} · {pct(learner.avgPercentage)}</p>
    </div>
    <TrendingUp size={14} className="shrink-0 text-emerald-500" />
  </div>
);

/* ─── Empty Panel ─────────────────────────────────────────────────────────────── */
const EmptyPanel = ({ icon: Icon, title }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
    <Icon size={26} className="mb-2 text-slate-300" />
    <p className="text-sm font-semibold text-slate-400">{title}</p>
  </div>
);

/* ─── Dashboard Card wrapper ──────────────────────────────────────────────────── */
const Card = ({ children, className = '', style }) => (
  <div
    className={`rounded-xl border border-slate-100 bg-white ${className}`}
    style={style}
  >
    {children}
  </div>
);

/* ─── Panel (padded card) ─────────────────────────────────────────────────────── */
const Panel = ({ children, className = '', title, icon, action }) => (
  <Card className={`p-4 ${className}`}>
    {title && <SectionHeader title={title} icon={icon} action={action} />}
    {children}
  </Card>
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
      accent: '#030b82',
      spark: true,
      onClick: () => onNavigate('teacher-learner-analysis'),
    },
    {
      label: 'Attendance Rate',
      value: loading ? '—' : pct(attendanceRate),
      sub: `${fmt(attendanceDue.length)} pending`,
      icon: CheckCircle2,
      accent: '#ff7900',
      spark: true,
      onClick: () => onNavigate('attendance-daily'),
    },
    {
      label: 'Assessments',
      value: loading ? '—' : fmt(assessmentsToMark.length),
      sub: 'Awaiting marks',
      icon: ClipboardList,
      accent: '#8b5cf6',
      spark: false,
      onClick: () => onNavigate('assess-summative-assessment'),
    },
    {
      label: 'Messages',
      value: loading ? '—' : fmt(stats.messages),
      sub: 'Inbox',
      icon: MessageSquare,
      accent: '#06285a',
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
    <div className="space-y-6">
      <GreetingToast user={user} fallbackName="Teacher" description="Teacher Dashboard · Today's Classes" onNavigate={onNavigate} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <AlertTriangle size={36} className="mb-3 text-[#ff7900]" />
        <h2 className="text-lg font-black text-[#06285a]">Teacher dashboard unavailable</h2>
        <p className="mt-2 text-sm text-slate-500">{apiError}</p>
        <button
          type="button" onClick={loadMetrics}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ff7900] px-5 py-2.5 text-sm font-black text-[#06285a] transition hover:opacity-90"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    </div>
  );

  /* ── Loading skeleton ─────────────────────────────────────── */
  if (loading && !metrics) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-[120px]" />)}
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
    <div className="space-y-4 pb-8">
      {/* Greeting */}
      <GreetingToast user={user} fallbackName="Teacher" description="Teacher Dashboard · Today's Classes" onNavigate={onNavigate} />

      {/* Sync indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2">
          <RefreshCw size={12} className="animate-spin text-blue-500" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Syncing…</p>
        </div>
      )}

      {/* ── Row 1: Stat tiles ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statTiles.map(tile => (
          <StatTile key={tile.label} {...tile} loading={loading} />
        ))}
      </div>

      {/* ── Row 2: Main content ───────────────────────────────── */}
      {/* Layout: [Left wide col: timetable + classes] [Right col: clock-in + actions + highlights] */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">

        {/* LEFT ─────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Next Lesson + Next Action side-by-side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Next Lesson */}
            <Panel
              title="Today's Timetable"
              icon={CalendarDays}
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('planner-timetable')}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40"
                >
                  Full schedule <ChevronRight size={10} />
                </button>
              }
            >
              <NextLessonCard lesson={nextLesson} onNavigate={onNavigate} />
              {/* Remaining lessons mini-list */}
              {schedule.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  {schedule.slice(1, 4).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <Dot size={16} className="shrink-0 text-[#ff7900]" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#06285a]">{s.subject}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{fmtTime(s.time)}</span>
                      <span className="shrink-0 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
                        {sessionLabel(s.time)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Next Action */}
            <Panel title="Next Up" icon={Bell} action={
              <button
                type="button"
                onClick={loadMetrics}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40"
              >
                <RefreshCw size={10} /> Refresh
              </button>
            }>
              <NextActionCard action={nextAction} onNavigate={onNavigate} />

              {/* Alerts & Events stacked below */}
              {(learnerAlerts.length > 0 || upcomingEvents.length > 0) && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alerts &amp; Events</p>
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
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40"
              >
                All classes <ChevronRight size={10} />
              </button>
            }
          >
            {classes.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {classes.slice(0, 6).map(c => <ClassCard key={c.id} item={c} onNavigate={onNavigate} />)}
              </div>
            ) : (
              <EmptyPanel icon={Users} title="No assigned classes" />
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
                  className="flex items-center gap-1 rounded-lg bg-[#ff7900] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
                >
                  Mark all <ArrowUpRight size={10} />
                </button>
              ) : null
            }
          >
            {assessmentsToMark.length > 0 ? (
              <div className="space-y-2">
                {assessmentsToMark.slice(0, 6).map((a, i) => (
                  <AssessmentRow key={a.id} assessment={a} index={i} onNavigate={onNavigate} />
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
              {resolvedActions.map((a, i) => (
                <QuickAction key={a.id || a.label} action={a} index={i} onNavigate={onNavigate} />
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
                  <div key={a.id} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <Star size={13} className="mt-0.5 shrink-0 text-[#ff7900]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#06285a]">{a.text}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{a.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Performance at a glance — decorative insight tile */}
          <div
            className="overflow-hidden rounded-xl p-4"
            style={{ background: 'linear-gradient(135deg,#06285a 0%,#030b82 100%)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Class Health</p>
                <p className="mt-1 text-2xl font-black text-white">{pct(attendanceRate)}</p>
                <p className="text-[11px] font-medium text-white/60">Avg Attendance</p>
              </div>
              <RadialRing value={Math.round(attendanceRate)} size={56} stroke={5} color="#ff7900" bg="rgba(255,255,255,0.15)" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="text-center">
                <p className="text-base font-black text-white">{fmt(assessmentsToMark.length)}</p>
                <p className="text-[10px] text-white/50">To Mark</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-base font-black text-white">{fmt(classes.length)}</p>
                <p className="text-[10px] text-white/50">Classes</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-base font-black text-white">{fmt(stats.myStudents)}</p>
                <p className="text-[10px] text-white/50">Learners</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
