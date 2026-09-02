/**
 * Teacher Mobile Dashboard
 * Clean, senior UX redesigned mobile-native daily workflow view.
 * Backed by /dashboard/teacher.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Calendar,
  MessageSquare,
  Users,
  Sparkles,
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

const EmptyState = ({ icon: Icon, title }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-6 text-center shadow-sm">
    <Icon size={24} className="mx-auto mb-2 text-slate-300" />
    <p className="text-xs font-semibold text-slate-500">{title}</p>
  </div>
);

const MetricCard = ({ metric, loading }) => {
  const Icon = metric.icon;
  return (
    <button
      type="button"
      onClick={metric.onClick}
      className="flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-left transition-all duration-150 active:scale-[0.98] hover:border-slate-300 min-h-[96px] group focus:outline-none"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-[11px] font-semibold text-slate-500 truncate tracking-tight">{metric.label}</span>
        <div className="w-7 h-7 rounded-lg bg-slate-100/90 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-slate-200/80 transition-colors">
          <Icon size={14} />
        </div>
      </div>
      <div className="mt-2">
        <p className="text-lg font-bold text-slate-900 tracking-tight leading-none">
          {loading ? <span className="text-slate-300">···</span> : metric.value}
        </p>
        {metric.sub && (
          <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">{metric.sub}</p>
        )}
      </div>
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
        const response = (await dashboardAPI.getTeacherMetrics?.()) || { success: true, data: {} };
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
  const attendanceDue = useMemo(() => metrics?.attendanceDue || [], [metrics?.attendanceDue]);
  const assessmentsToMark = useMemo(() => metrics?.assessmentsToMark || [], [metrics?.assessmentsToMark]);
  const learnerAlerts = useMemo(() => metrics?.learnersNeedingAttention || [], [metrics?.learnersNeedingAttention]);
  const upcomingEvents = useMemo(() => metrics?.upcomingEvents || [], [metrics?.upcomingEvents]);
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
      sub: 'Enrolled',
      icon: Users,
      onClick: () => onNavigate('teacher-learner-analysis'),
    },
    {
      label: 'Attendance',
      value: formatPercent(attendanceRate),
      sub: `${formatNumber(attendanceDue.length)} classes due`,
      icon: CheckCircle2,
      onClick: () => onNavigate('attendance-daily'),
    },
    {
      label: 'Assessments',
      value: formatNumber(assessmentsToMark.length),
      sub: 'To evaluate',
      icon: ClipboardList,
      onClick: () => onNavigate('assess-summative-assessment'),
    },
    {
      label: 'Messages',
      value: formatNumber(stats.messages),
      sub: 'Unread updates',
      icon: MessageSquare,
      onClick: () => onNavigate('communication'),
    },
  ];

  return (
    <div className="space-y-4 text-slate-900">
      {/* Greeting Header */}
      <GreetingToast
        user={user}
        fallbackName="Teacher"
        description="Teacher Dashboard · Daily Overview"
        onNavigate={onNavigate}
      />

      {/* Clock In / Attendance Status */}
      <div>
        <ClockInStatusWidget user={user} onNavigate={onNavigate} />
      </div>

      {/* Quick Stats Grid */}
      <div>
        <div className="flex items-center justify-between px-0.5 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Overview</p>
          <span className="text-[10px] font-medium text-slate-500">Today</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {teacherMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} loading={loading} />
          ))}
        </div>
      </div>

      {/* Next Up Priority Action */}
      <div>
        <div className="flex items-center justify-between px-0.5 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Next Action</p>
          <span className="text-[10px] font-medium text-slate-500">Priority</span>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-xs font-semibold text-slate-400 animate-pulse">
            Loading schedule…
          </div>
        ) : nextAction ? (
          <button
            type="button"
            onClick={() => onNavigate(nextAction.navigateTo)}
            className="group w-full rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all active:scale-[0.99] hover:border-slate-300 focus:outline-none"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Bell size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{nextAction.title}</p>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {nextAction.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <span>{nextAction.actionLabel}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </button>
        ) : (
          <EmptyState icon={CheckCircle2} title="No urgent tasks right now — all clear!" />
        )}
      </div>

      {/* Alerts & Upcoming Schedule */}
      {!loading && (learnerAlerts.length > 0 || upcomingEvents.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Alerts & Events</p>
            <span className="text-[10px] font-medium text-slate-500">Notice</span>
          </div>

          {/* Learner Risk Alerts */}
          {learnerAlerts.slice(0, 2).map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => onNavigate(alert.actionPage || 'teacher-learner-analysis')}
              className="flex w-full items-center gap-3 rounded-2xl border border-amber-200/80 bg-white p-3.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all active:scale-[0.99] hover:border-amber-300 focus:outline-none"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{alert.name}</p>
                <p className="truncate text-xs text-slate-500 mt-0.5">{alert.issue}</p>
              </div>
              <ChevronRight size={15} className="shrink-0 text-slate-300" />
            </button>
          ))}

          {/* Calendar Events */}
          {upcomingEvents.slice(0, 2).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onNavigate('annual-planner')}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all active:scale-[0.99] hover:border-slate-300 focus:outline-none"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Calendar size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{event.title}</p>
                <p className="truncate text-xs text-slate-500 mt-0.5">
                  {formatDate(event.date)} · {event.type || 'Academic Calendar'}
                </p>
              </div>
              <ChevronRight size={15} className="shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherMobileDashboard;
