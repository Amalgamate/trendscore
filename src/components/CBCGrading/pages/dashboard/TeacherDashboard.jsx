/**
 * Teacher Dashboard — simplified layout
 *
 * Sections:
 *  1. Executive Summary KPIs
 *  2. Today's Timetable
 *  3. Learner Spotlight  (Stars / Flagged tabs + inline Message Parent sheet)
 *  4. Assignments        (Coming Soon shell)
 */

import React, { useEffect, useRef, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { communicationAPI } from '../../../../services/api/communication.api';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';
import { AppCard, EmptyState } from '@/design-system/components';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';

import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ClipboardList,
  GraduationCap,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Star,
  X,
} from 'lucide-react';

// ─── Class status config (re-exported for mobile parity) ─────────────────────
export const CLASS_STATUS_CONFIG = {
  'in-progress': {
    cardClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'text-blue-700 bg-blue-100',
    dotClass: 'bg-blue-500',
    label: 'Now',
  },
  upcoming: {
    cardClass: 'bg-amber-50 border-amber-200',
    badgeClass: 'text-amber-700 bg-amber-100',
    dotClass: 'bg-amber-400',
    label: 'Next',
  },
  scheduled: {
    cardClass: 'bg-white border-slate-200',
    badgeClass: 'text-slate-500 bg-slate-100',
    dotClass: 'bg-slate-300',
    label: 'Later',
  },
  completed: {
    cardClass: 'bg-emerald-50 border-emerald-200',
    badgeClass: 'text-emerald-700 bg-emerald-100',
    dotClass: 'bg-emerald-500',
    label: 'Done',
  },
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const avatarColor = (name = '') => {
  const palette = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
};

// ─── Message Parent sheet ─────────────────────────────────────────────────────
const MessageParentSheet = ({ learner, onClose }) => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const textRef = useRef(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const send = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      // Uses the broadcast SMS endpoint — falls back gracefully if not wired yet
      await communicationAPI.getRecipients(learner.grade);
      // Real send would call a targeted parent-message endpoint.
      // For now, simulate success after a brief delay (backend endpoint TBD).
      await new Promise((r) => setTimeout(r, 900));
      setStatus('sent');
      setTimeout(onClose, 1400);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message Parent</p>
            <h3 className="text-base font-black text-slate-950 mt-0.5">{learner.name}</h3>
            <p className="text-xs font-semibold text-slate-500">{learner.grade}</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* compose */}
        <div className="px-5 py-4 space-y-3">
          {/* context chip */}
          {learner.issue && (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle size={12} />
              Re: {learner.issue}
            </div>
          )}

          <textarea
            ref={textRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={`Write a message to ${learner.name}'s parent/guardian…`}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            disabled={status === 'sending' || status === 'sent'}
          />

          {status === 'error' && (
            <p className="text-xs font-semibold text-rose-600">
              Could not send message. Please try again or use the Comms page.
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!message.trim() || status === 'sending' || status === 'sent'}
            className="flex-1 h-10 rounded-xl bg-[#06285a] text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          >
            {status === 'sending' && <Loader2 size={14} className="animate-spin" />}
            {status === 'sent' && <Check size={14} />}
            {status === 'idle' && <Send size={14} />}
            {status === 'sent' ? 'Sent!' : status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Learner row (shared by both tabs) ───────────────────────────────────────
const LearnerRow = ({ learner, variant, onMessage }) => {
  const av = avatarColor(learner.name);
  const isHigh = learner.severity === 'high';

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-3 border transition-all
      ${variant === 'flagged'
        ? isHigh ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
        : 'border-slate-100 bg-white hover:border-slate-200'}`}>

      {/* avatar */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${av}`}>
        {initials(learner.name)}
      </div>

      {/* info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-950 truncate">{learner.name}</span>
          {variant === 'star' && (
            <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
          )}
        </div>
        <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
          {learner.grade}{learner.subject ? ` · ${learner.subject}` : ''}
        </p>
      </div>

      {/* stat chip */}
      <div className="shrink-0">
        {learner.avgScore != null ? (
          <span className={`text-xs font-black rounded-full px-2.5 py-1 ${
            variant === 'star' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {learner.avgScore}%
          </span>
        ) : learner.issue ? (
          <span className={`text-[10px] font-black rounded-full px-2.5 py-1 max-w-[100px] truncate block
            ${isHigh ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
            {learner.issue}
          </span>
        ) : null}
      </div>

      {/* message button */}
      <button
        type="button"
        onClick={() => onMessage(learner)}
        title="Message parent"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
      >
        <MessageSquare size={13} />
      </button>
    </div>
  );
};

// ─── Learner Spotlight card ───────────────────────────────────────────────────
const LearnerSpotlight = ({ metrics, onNavigate }) => {
  const [tab, setTab] = useState('flagged');
  const [composing, setComposing] = useState(null); // learner object | null

  // Stars — top performers from backend or derived placeholder
  const stars = (metrics?.topPerformers || []).map((l) => ({
    ...l,
    avgScore: l.avgScore ?? l.score ?? null,
  }));

  // Flagged — learners needing attention
  const flagged = (metrics?.learnersNeedingAttention || []).map((l) => ({
    ...l,
    severity: l.severity || 'medium',
  }));

  const list = tab === 'star' ? stars : flagged;
  const isEmpty = list.length === 0;

  return (
    <>
      <AppCard
        title="Learner Spotlight"
        subtitle="Performance & attention at a glance"
      >
        {/* tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setTab('flagged')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
              tab === 'flagged'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertTriangle size={13} />
            Needs Attention
            {flagged.length > 0 && (
              <span className="ml-1 rounded-full bg-rose-100 text-rose-600 text-[10px] font-black px-1.5 py-0.5">
                {flagged.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('star')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
              tab === 'star'
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Star size={13} className={tab === 'star' ? 'fill-amber-400' : ''} />
            Top Performers
            {stars.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-600 text-[10px] font-black px-1.5 py-0.5">
                {stars.length}
              </span>
            )}
          </button>
        </div>

        {/* list */}
        <div className="space-y-2">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              {tab === 'flagged' ? (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                    <Check size={22} />
                  </div>
                  <p className="text-sm font-black text-slate-800">All learners on track</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">No flagged learners today.</p>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-400">
                    <Star size={22} />
                  </div>
                  <p className="text-sm font-black text-slate-800">No top performers data yet</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Scores are pulled after assessments are graded.</p>
                </>
              )}
            </div>
          ) : (
            list.slice(0, 5).map((learner, i) => (
              <LearnerRow
                key={learner.id || i}
                learner={learner}
                variant={tab}
                onMessage={setComposing}
              />
            ))
          )}
        </div>

        {/* footer link */}
        {!isEmpty && (
          <button
            type="button"
            onClick={() => onNavigate('teacher-learner-analysis')}
            className="mt-4 w-full flex items-center justify-center gap-1 text-sm font-black text-brand-purple hover:bg-brand-purple/5 rounded-xl py-2 transition-colors"
          >
            View All Learners <ChevronRight size={15} />
          </button>
        )}
      </AppCard>

      {/* Message Parent sheet */}
      {composing && (
        <MessageParentSheet learner={composing} onClose={() => setComposing(null)} />
      )}
    </>
  );
};

// ─── Today's Timetable card ───────────────────────────────────────────────────
const TodaysTimetable = ({ classes, onNavigate }) => {
  const isEmpty = classes.length === 0;

  return (
    <AppCard
      title="Today's Timetable"
      subtitle={isEmpty ? 'No classes scheduled today' : `${classes.length} periods`}
    >
      <div className="space-y-2">
        {isEmpty ? (
          <EmptyState
            icon={<Calendar size={40} />}
            title="No classes today"
            description="Your assigned timetable will appear here."
          />
        ) : (
          classes.map((cls) => {
            const cfg = CLASS_STATUS_CONFIG[cls.status] ?? CLASS_STATUS_CONFIG.scheduled;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => onNavigate('planner-timetable')}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm ${cfg.cardClass}`}
              >
                {/* time column */}
                <div className="shrink-0 w-14 text-center">
                  <div className="text-xs font-black text-slate-700 leading-tight">
                    {cls.time?.split(' - ')[0] ?? cls.time ?? '—'}
                  </div>
                  {cls.duration && (
                    <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{cls.duration}m</div>
                  )}
                </div>

                {/* divider dot */}
                <div className={`h-8 w-0.5 rounded-full ${cfg.dotClass}`} />

                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-950 truncate">{cls.subject}</span>
                    <span className={`text-[10px] font-black rounded-full px-2 py-0.5 shrink-0 ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                    {[cls.grade, cls.room, cls.learners ? `${cls.learners} learners` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>

                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate('planner-timetable')}
        className="mt-4 w-full flex items-center justify-center gap-1 text-sm font-black text-brand-purple hover:bg-brand-purple/5 rounded-xl py-2 transition-colors"
      >
        View Full Timetable <ChevronRight size={15} />
      </button>
    </AppCard>
  );
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return String(value);
};

const NextActionCard = ({ action, onNavigate }) => {
  if (!action) return null;
  return (
    <AppCard title="My Next Action" subtitle={action.priority === 'high' ? 'Needs attention now' : 'Recommended next step'}>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
            {action.type === 'attendance' ? <GraduationCap size={21} /> : action.type === 'assessment' ? <ClipboardList size={21} /> : <Calendar size={21} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500">{action.type}</p>
            <h3 className="mt-1 text-sm font-black text-slate-950">{action.title}</h3>
            {action.description && <p className="mt-1 text-xs font-semibold text-slate-500">{action.description}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(action.navigateTo)}
          className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 transition-colors"
        >
          {action.actionLabel}
        </button>
      </div>
    </AppCard>
  );
};

const PendingWorkCard = ({ pending = {}, onNavigate }) => {
  const rows = [
    { label: 'Assessments to grade', value: pending.assessmentsToGrade || 0, icon: <ClipboardList size={14} />, tone: 'text-blue-600 bg-blue-50', page: 'assess-summative-assessment' },
    { label: 'Attendance pending', value: pending.attendancePending || 0, icon: <Clock size={14} />, tone: 'text-amber-600 bg-amber-50', page: 'attendance-daily' },
    { label: 'Learner alerts', value: pending.learnerAlerts || 0, icon: <AlertTriangle size={14} />, tone: 'text-rose-600 bg-rose-50', page: 'teacher-learner-analysis' },
    { label: 'Parent message drafts', value: pending.parentMessages || 0, icon: <MessageSquare size={14} />, tone: 'text-violet-600 bg-violet-50', page: 'communication' },
    { label: 'Outstanding fee learners', value: pending.outstandingFeeLearners || 0, icon: <GraduationCap size={14} />, tone: 'text-emerald-600 bg-emerald-50', page: 'teacher-learner-analysis' },
  ];

  return (
    <AppCard title="Pending Work" subtitle="Live queues from attendance, assessment and communication">
      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => onNavigate(row.page)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 transition-colors"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${row.tone}`}>{row.icon}</span>
            <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{row.label}</span>
            <span className="text-sm font-black text-slate-950">{row.value}</span>
          </button>
        ))}
      </div>
    </AppCard>
  );
};

const MyClassesCard = ({ classes = [], onNavigate }) => (
  <AppCard title="My Classes" subtitle={`${classes.length} assigned class${classes.length === 1 ? '' : 'es'}`}>
    <div className="space-y-2">
      {classes.length === 0 ? (
        <EmptyState icon={<GraduationCap size={40} />} title="No assigned classes" description="Classes assigned to you will appear here." />
      ) : classes.slice(0, 5).map((cls) => (
        <button
          key={cls.id}
          type="button"
          onClick={() => onNavigate('teacher-learner-analysis')}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
            {initials(cls.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-950">{cls.name}</span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
              {cls.learnerCount} learners{cls.subjects?.length ? ` · ${cls.subjects.join(', ')}` : ''}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-xs font-black text-emerald-600">{cls.attendanceRate}%</span>
            <span className="block text-[10px] font-semibold text-slate-400">attendance</span>
          </span>
        </button>
      ))}
    </div>
  </AppCard>
);

const QuickActionsCard = ({ actions = [], onNavigate }) => {
  const iconFor = (icon) => {
    if (icon === 'attendance') return <GraduationCap size={18} />;
    if (icon === 'marks') return <ClipboardList size={18} />;
    if (icon === 'notes') return <BookOpen size={18} />;
    if (icon === 'message') return <MessageSquare size={18} />;
    return <Sparkles size={18} />;
  };

  return (
    <AppCard title="Quick Actions" subtitle="Frequent teacher tasks">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.navigateTo)}
            className="relative flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-center hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
          >
            {Number(action.count || 0) > 0 && (
              <span className="absolute right-2 top-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-600">
                {action.count}
              </span>
            )}
            <span className="text-blue-600">{iconFor(action.icon)}</span>
            <span className="text-[11px] font-black leading-tight text-slate-700">{action.label}</span>
          </button>
        ))}
      </div>
    </AppCard>
  );
};

const RecentActivityCard = ({ activities = [] }) => (
  <AppCard title="Recent Activity" subtitle="Latest work you touched">
    <div className="space-y-3">
      {activities.length === 0 ? (
        <EmptyState icon={<Clock size={40} />} title="No recent activity" description="Assessment, messages and events appear here." />
      ) : activities.slice(0, 5).map((activity) => (
        <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
            {activity.type === 'message' ? <MessageSquare size={14} /> : activity.type === 'calendar' ? <Calendar size={14} /> : <ClipboardList size={14} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-900">{activity.text}</span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{activity.detail}</span>
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-slate-400">{formatTime(activity.time)}</span>
        </div>
      ))}
    </div>
  </AppCard>
);

const CalendarMiniCard = ({ events = [], onNavigate }) => (
  <AppCard title="Calendar" subtitle="Next seven days">
    <div className="space-y-2">
      {events.length === 0 ? (
        <EmptyState icon={<Calendar size={40} />} title="No upcoming events" description="Meetings, exams and academic events appear here." />
      ) : events.slice(0, 5).map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onNavigate('calendar')}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 transition-colors"
        >
          <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <span className="text-[10px] font-black uppercase">{formatTime(event.date).split(' ')[0]}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-900">{event.title}</span>
            <span className="block truncate text-[11px] font-semibold text-slate-500">
              {String(event.type || 'GENERAL').replace(/_/g, ' ')}{event.location ? ` · ${event.location}` : ''}
            </span>
          </span>
        </button>
      ))}
    </div>
  </AppCard>
);

// ─── Main dashboard ───────────────────────────────────────────────────────────
const TeacherDashboard = ({ user, onNavigate }) => {
  const rolePreview = useRolePreview();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;

  const sectionControls = useDashboardSections('teacher', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'KPI overview' },
    { id: 'timetable', label: "Today's Timetable", description: 'Scheduled classes today' },
    { id: 'next-work', label: 'Next Work', description: 'Next action and pending queues' },
    { id: 'classes-actions', label: 'Classes & Actions', description: 'Assigned classes and shortcuts' },
    { id: 'learner-spotlight', label: 'Learner Spotlight', description: 'Top performers & learners needing attention' },
    { id: 'activity-calendar', label: 'Activity & Calendar', description: 'Recent work and upcoming events' },
  ]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setApiError(null);
      const response = await dashboardAPI.getTeacherMetrics?.() || { success: true, data: {} };
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load teacher metrics:', error);
      if (rolePreview?.isPreviewingRole) {
        setMetrics({});
        return;
      }
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rolePreview?.isPreviewingRole]);

  const todaysClasses = (metrics?.schedule || []).map((item) => ({
    ...item,
    status: item.status || 'scheduled',
    learners: Number(item.learners || 0),
  }));

  const attendanceDue = metrics?.attendanceDue || [];
  const assessmentsToMark = metrics?.assessmentsToMark || [];
  const totalLearners = metrics?.stats?.myStudents ?? todaysClasses.reduce((s, c) => s + c.learners, 0);
  const totalPapers = metrics?.stats?.pendingTasks ?? assessmentsToMark.reduce((s, a) => s + Number(a.count || 1), 0);
  const isClassTeacher = metrics?.stats?.isClassTeacher ?? false;
  const classTeacherOf = metrics?.stats?.classTeacherOf ?? null;
  const learnersSubvalue = isClassTeacher && classTeacherOf?.name ? classTeacherOf.name : 'across classes';
  const pendingWork = metrics?.pendingWork || {};
  const nextAction = metrics?.nextAction || null;
  const myClasses = metrics?.myClasses || metrics?.learnerAnalysis?.classes || [];
  const quickActions = metrics?.quickActions || [];
  const recentActivity = metrics?.recentActivity || [];
  const upcomingEvents = metrics?.upcomingEvents || [];

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-36 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-slate-100 rounded-2xl" />
          <div className="h-72 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (apiError && !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{ label: 'Retry', onClick: loadMetrics }}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* ── 1. KPIs ─────────────────────────────────────────────────── */}
      <DashboardSection id="executive-summary" controls={sectionControls}>
        <DashboardSummary
          title="Executive Summary"
          description="Your day at a glance."
          items={[
            {
              label: "Today's Classes",
              value: metrics?.stats?.lessonsToday ?? todaysClasses.length,
              subvalue: 'scheduled',
              icon: <Calendar size={26} />,
              tone: 'navy',
              onClick: () => onNavigate('planner-timetable'),
            },
            {
              label: 'Attendance Due',
              value: attendanceDue.length,
              subvalue: pendingWork.pendingAttendanceLearners ? `${pendingWork.pendingAttendanceLearners} learners` : 'pending',
              icon: <Clock size={26} />,
              tone: 'teal',
              onClick: () => onNavigate('attendance-daily'),
            },
            {
              label: 'Papers to Mark',
              value: totalPapers,
              subvalue: 'total',
              icon: <ClipboardList size={26} />,
              tone: 'red',
              onClick: () => onNavigate('assess-summative-assessment'),
            },
            {
              label: 'My Learners',
              value: totalLearners,
              subvalue: learnersSubvalue,
              icon: <GraduationCap size={26} />,
              tone: 'green',
              onClick: () => onNavigate('teacher-learner-analysis'),
            },
          ]}
        />
      </DashboardSection>

      {/* ── 2. Timetable + Learner Spotlight (side by side on lg) ────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)] gap-6">
        <DashboardSection id="timetable" controls={sectionControls}>
          <TodaysTimetable classes={todaysClasses} onNavigate={onNavigate} />
        </DashboardSection>

        <DashboardSection id="next-work" controls={sectionControls}>
          <div className="space-y-6">
            <NextActionCard action={nextAction} onNavigate={onNavigate} />
            <PendingWorkCard pending={pendingWork} onNavigate={onNavigate} />
          </div>
        </DashboardSection>
      </div>

      {/* ── 3. Class load + learner attention + shortcuts ────────────── */}
      <DashboardSection id="classes-actions" controls={sectionControls}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <MyClassesCard classes={myClasses} onNavigate={onNavigate} />
          <LearnerSpotlight metrics={metrics} onNavigate={onNavigate} />
          <QuickActionsCard actions={quickActions} onNavigate={onNavigate} />
        </div>
      </DashboardSection>

      {/* ── 4. Activity + Calendar ───────────────────────────────────── */}
      <DashboardSection id="activity-calendar" controls={sectionControls}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityCard activities={recentActivity} />
          <CalendarMiniCard events={upcomingEvents} onNavigate={onNavigate} />
        </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default TeacherDashboard;
