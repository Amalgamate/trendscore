/**
 * Teacher Mobile Dashboard
 * Mobile-native daily workflow view backed by /dashboard/teacher.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  BookOpen,
  MessageSquare,
  Users,
} from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';
import ClockInStatusWidget from '../widgets/teacher/ClockInStatusWidget';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

const formatTime = (value) => {
  if (!value) return '--:--';
  const time = String(value);
  return time.length >= 5 ? time.slice(0, 5) : time;
};

const getSessionLabel = (time) => {
  const hour = Number(String(time || '').split(':')[0]);
  if (!Number.isFinite(hour)) return 'Today';
  if (hour < 12) return 'Morning';
  if (hour < 16) return 'Afternoon';
  return 'Evening';
};

const iconMap = {
  attendance: CheckCircle2,
  marks: ClipboardList,
  'lesson-notes': BookOpen,
  notes: BookOpen,
  message: MessageSquare,
  learners: Users,
};

const EmptyState = ({ icon: Icon, title }) => (
  <div className="ts-mobile-card-soft rounded-xl border-dashed p-5 text-center">
    <Icon size={26} className="mx-auto mb-2 opacity-30" />
    <p className="text-xs font-medium">{title}</p>
  </div>
);

const MetricCard = ({ metric, index, loading }) => {
  const Icon = metric.icon;
  return (
    <button
      type="button"
      onClick={metric.onClick}
      className={`${index % 2 ? 'ts-mobile-card-orange' : 'ts-mobile-card'} flex w-full items-center gap-3 rounded-lg p-3 text-left`}
    >
      <Icon size={20} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium opacity-75">{metric.label}</p>
        <p className="truncate text-base font-bold">{loading ? '...' : metric.value}</p>
      </div>
      {metric.onClick && <ChevronRight size={16} className="shrink-0 opacity-70" />}
    </button>
  );
};

const ActionButton = ({ action, index, onNavigate }) => {
  const Icon = iconMap[action.icon] || ChevronRight;

  return (
    <button
      type="button"
      onClick={() => onNavigate(action.navigateTo)}
      className={`${index % 2 ? 'ts-mobile-action-solid' : 'ts-mobile-action'} flex min-h-[3rem] items-center justify-between gap-2 rounded-lg p-3 text-left text-xs font-semibold transition`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={15} className="shrink-0" />
        <span className="truncate">{action.label}</span>
      </span>
      {Number(action.count || 0) > 0 && (
        <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black">
          {formatNumber(action.count)}
        </span>
      )}
    </button>
  );
};

const TeacherMobileDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getTeacherMetrics?.() || { success: true, data: {} };
        if (active && response.success) setMetrics(response.data);
      } catch (error) {
        console.error('Failed to load teacher metrics:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, []);

  const stats = metrics?.stats || {};
  const pendingWork = metrics?.pendingWork || {};
  const schedule = useMemo(() => metrics?.schedule || [], [metrics?.schedule]);
  const attendanceDue = useMemo(() => metrics?.attendanceDue || [], [metrics?.attendanceDue]);
  const assessmentsToMark = useMemo(() => metrics?.assessmentsToMark || [], [metrics?.assessmentsToMark]);
  const classes = useMemo(() => metrics?.myClasses || [], [metrics?.myClasses]);
  const learnerAlerts = useMemo(() => metrics?.learnersNeedingAttention || [], [metrics?.learnersNeedingAttention]);
  const upcomingEvents = useMemo(() => metrics?.upcomingEvents || [], [metrics?.upcomingEvents]);
  const quickActions = useMemo(() => metrics?.quickActions || [], [metrics?.quickActions]);

  const nextLesson = schedule.find((item) => item.status === 'in-progress') ||
    schedule.find((item) => item.status === 'upcoming') ||
    schedule[0] ||
    null;
  const nextAction = metrics?.nextAction;

  const pendingAttendanceLearners = Number(pendingWork.pendingAttendanceLearners || 0);
  const attendanceRate = stats.analytics?.attendance ?? (
    Number(stats.myStudents || 0) > 0
      ? ((Number(stats.myStudents || 0) - pendingAttendanceLearners) / Number(stats.myStudents || 1)) * 100
      : 0
  );

  const teacherMetrics = [
    {
      label: 'My Learners',
      value: formatNumber(stats.myStudents),
      icon: Users,
      onClick: () => onNavigate('teacher-learner-analysis'),
    },
    {
      label: 'Attendance',
      value: `${formatPercent(attendanceRate)} · ${formatNumber(attendanceDue.length)} pending`,
      icon: CheckCircle2,
      onClick: () => onNavigate('attendance-daily'),
    },
    {
      label: 'Assessments',
      value: `${formatNumber(assessmentsToMark.length)} to mark`,
      icon: ClipboardList,
      onClick: () => onNavigate('assess-summative-assessment'),
    },
    {
      label: 'Messages',
      value: formatNumber(stats.messages),
      icon: MessageSquare,
      onClick: () => onNavigate('communication'),
    },
  ];

  return (
    <div className="min-h-full pb-20 text-white">
      <GreetingToast user={user} fallbackName="Teacher" description="Teacher Dashboard · Today's Classes" onNavigate={onNavigate} />

      <div className="px-3 py-4">
        <ClockInStatusWidget user={user} onNavigate={onNavigate} />
      </div>

      <div className="space-y-3 px-3 pb-2">
        {teacherMetrics.map((metric, index) => (
          <MetricCard key={metric.label} metric={metric} index={index} loading={loading} />
        ))}
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className="ts-mobile-section-title px-2 text-xs font-semibold uppercase">Next Up</p>
        {loading ? (
          <div className="ts-mobile-card rounded-xl p-3 text-sm font-semibold">Loading...</div>
        ) : nextAction ? (
          <button
            type="button"
            onClick={() => onNavigate(nextAction.navigateTo)}
            className="ts-mobile-card w-full rounded-xl p-3 text-left transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Bell size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{nextAction.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{nextAction.description}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-brand-purple">{nextAction.actionLabel}</p>
              </div>
              <ChevronRight size={16} className="mt-1 shrink-0 text-gray-400" />
            </div>
          </button>
        ) : (
          <EmptyState icon={CheckCircle2} title="No urgent teacher action right now" />
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className="ts-mobile-section-title px-2 text-xs font-semibold uppercase">Today's Timetable</p>
        {!loading && nextLesson ? (
          <button
            type="button"
            onClick={() => onNavigate('planner-timetable')}
            className="ts-mobile-card-orange w-full rounded-xl p-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <CalendarDays size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{nextLesson.subject || 'No lesson scheduled'}</p>
                  <span className="shrink-0 rounded-md bg-white/40 px-2 py-0.5 text-[9px] font-black uppercase text-gray-800">
                    {getSessionLabel(nextLesson.time)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-600">
                  {formatTime(nextLesson.time)}
                  {nextLesson.endTime ? ` - ${formatTime(nextLesson.endTime)}` : ''}
                  {nextLesson.grade || nextLesson.className ? ` · ${nextLesson.grade || nextLesson.className}` : ''}
                  {nextLesson.room ? ` · ${nextLesson.room}` : ''}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-500" />
            </div>
          </button>
        ) : (
          <EmptyState icon={CalendarDays} title={loading ? 'Loading timetable...' : 'No lessons scheduled today'} />
        )}
      </div>

      {!loading && classes.length > 0 && (
        <div className="space-y-2 px-3 py-3">
          <p className="ts-mobile-section-title px-2 text-xs font-semibold uppercase">My Classes</p>
          {classes.slice(0, 4).map((classItem) => (
            <button
              key={classItem.id}
              type="button"
              onClick={() => onNavigate('teacher-learner-analysis')}
              className="ts-mobile-card flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-base font-bold text-brand-purple">
                {String(classItem.name || '?').trim()[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{classItem.name}</p>
                <p className="text-xs text-gray-500">
                  {formatNumber(classItem.learnerCount)} learners · {formatPercent(classItem.attendanceRate)} attendance
                </p>
                {classItem.subjects?.length > 0 && (
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-500">
                    {classItem.subjects.join(' · ')}
                  </p>
                )}
              </div>
              {Number(classItem.pending || 0) > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">
                  {formatNumber(classItem.pending)} due
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && (learnerAlerts.length > 0 || upcomingEvents.length > 0) && (
        <div className="space-y-2 px-3 py-3">
          <p className="ts-mobile-section-title px-2 text-xs font-semibold uppercase">Alerts & Events</p>
          {learnerAlerts.slice(0, 2).map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => onNavigate(alert.actionPage || 'teacher-learner-analysis')}
              className="ts-mobile-card flex w-full items-center gap-3 rounded-xl p-3 text-left"
            >
              <AlertTriangle size={18} className="shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{alert.name}</p>
                <p className="truncate text-xs text-gray-500">{alert.issue}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
          ))}
          {upcomingEvents.slice(0, 2).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onNavigate('annual-planner')}
              className="ts-mobile-card-orange flex w-full items-center gap-3 rounded-xl p-3 text-left"
            >
              <Clock3 size={18} className="shrink-0 text-gray-800" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
                <p className="truncate text-xs text-gray-600">{formatDate(event.date)} · {event.type || 'Calendar'}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-500" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 px-3 py-3">
        <p className="ts-mobile-section-title px-2 text-xs font-semibold uppercase">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {(quickActions.length > 0 ? quickActions : [
            { id: 'attendance', label: 'Take Attendance', icon: 'attendance', navigateTo: 'attendance-daily' },
            { id: 'marks', label: 'Enter Marks', icon: 'marks', navigateTo: 'assess-summative-assessment' },
            { id: 'lesson-notes', label: 'Lesson Notes', icon: 'lesson-notes', navigateTo: 'learning-hub-lesson-plans' },
            { id: 'learners', label: 'Learners', icon: 'learners', navigateTo: 'teacher-learner-analysis' },
          ]).slice(0, 4).map((action, index) => (
            <ActionButton key={action.id || action.label} action={action} index={index} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherMobileDashboard;
