/**
 * Teacher Mobile Dashboard
 * Compact daily workflow view.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Users,
} from 'lucide-react';
import ClockInStatusWidget from '../widgets/teacher/ClockInStatusWidget';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const getSessionLabel = (time) => {
  const hour = Number(String(time || '').split(':')[0]);
  if (!Number.isFinite(hour)) return 'Session';
  if (hour < 12) return 'Morning Session';
  if (hour < 16) return 'Afternoon Session';
  return 'Evening Session';
};

const WorkflowCard = ({ icon: Icon, title, badge, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-xl border border-blue-100 bg-white px-3 py-3 text-left shadow-sm transition active:scale-[0.99]"
  >
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-xs font-black text-[#06285a]">{title}</h2>
          {badge && (
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[8px] font-black text-blue-700">
              {badge}
            </span>
          )}
        </div>
        {children}
      </div>
      <ChevronRight size={17} className="shrink-0 text-[#06285a]" />
    </div>
  </button>
);

const StatTriplet = ({ items }) => (
  <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 text-center">
    {items.map((item) => (
      <div key={item.label} className="px-2">
        <div className={`text-[9px] font-black ${item.labelClass}`}>{item.label}</div>
        <div className={`mt-1 text-base font-black ${item.valueClass}`}>{formatNumber(item.value)}</div>
      </div>
    ))}
  </div>
);

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
        console.error('Failed to load metrics:', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, []);

  const stats = metrics?.stats || {};
  const schedule = useMemo(() => metrics?.schedule || [], [metrics?.schedule]);
  const attendanceDue = useMemo(() => metrics?.attendanceDue || [], [metrics?.attendanceDue]);
  const assessmentsToMark = useMemo(() => metrics?.assessmentsToMark || [], [metrics?.assessmentsToMark]);
  const upcomingEvents = useMemo(() => metrics?.upcomingEvents || [], [metrics?.upcomingEvents]);
  const pendingWork = metrics?.pendingWork || {};

  const pendingAttendanceLearners = attendanceDue.reduce((sum, item) => (
    sum + Math.max(0, Number(item.learners || 0) - Number(item.marked || 0))
  ), 0);
  const totalLearners = Number(stats.myStudents || 0);
  const present = Math.max(0, totalLearners - pendingAttendanceLearners);
  const absent = Number(metrics?.attendanceSummary?.absent || 0);
  const late = Number(metrics?.attendanceSummary?.late || 0);

  const nextLesson = schedule.find((item) => item.status === 'in-progress') ||
    schedule.find((item) => item.status === 'upcoming') ||
    schedule[0] ||
    null;

  const submitted = Number(metrics?.homeworkSummary?.submitted || 0);
  const notSubmitted = Number(metrics?.homeworkSummary?.notSubmitted || pendingWork.assessmentsToGrade || assessmentsToMark.length || 0);
  const toReview = Number(metrics?.homeworkSummary?.toReview || stats.pendingTasks || 0);
  const dutyCount = Number(metrics?.plannerSummary?.duties || pendingWork.parentMessages || 0);

  return (
    <div className="min-h-full bg-slate-50 pb-20 text-[#06285a]">
      <div className="space-y-3 px-3 py-4">
        <ClockInStatusWidget user={user} onNavigate={onNavigate} />

        <WorkflowCard icon={Users} title="Today's Attendance" onClick={() => onNavigate('attendance-daily')}>
          <StatTriplet
            items={[
              { label: 'Present', value: loading ? 0 : present, labelClass: 'text-emerald-600', valueClass: 'text-emerald-600' },
              { label: 'Absent', value: loading ? 0 : absent, labelClass: 'text-red-600', valueClass: 'text-red-600' },
              { label: 'Late', value: loading ? 0 : late, labelClass: 'text-orange-500', valueClass: 'text-orange-500' },
            ]}
          />
        </WorkflowCard>

        <WorkflowCard
          icon={CalendarDays}
          title="Today's Timetable"
          badge={nextLesson ? getSessionLabel(nextLesson.time) : 'No Session'}
          onClick={() => onNavigate('planner-timetable')}
        >
          <div className="mt-3 grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-2 text-[10px] font-bold">
            <span className="text-slate-500">{nextLesson?.time || '--:--'}</span>
            <span className="truncate text-[#06285a]">{nextLesson?.subject || 'No lesson scheduled'}</span>
            <span className="truncate text-right text-slate-500">{nextLesson?.grade || nextLesson?.className || ''}</span>
          </div>
        </WorkflowCard>

        <WorkflowCard icon={ClipboardList} title="Homework & Assignments" onClick={() => onNavigate('assess-summative-assessment')}>
          <StatTriplet
            items={[
              { label: 'Submitted', value: loading ? 0 : submitted, labelClass: 'text-emerald-600', valueClass: 'text-emerald-600' },
              { label: 'Not Submitted', value: loading ? 0 : notSubmitted, labelClass: 'text-red-600', valueClass: 'text-red-600' },
              { label: 'To Review', value: loading ? 0 : toReview, labelClass: 'text-indigo-600', valueClass: 'text-indigo-600' },
            ]}
          />
        </WorkflowCard>

        <WorkflowCard icon={CheckCircle2} title="Planner" onClick={() => onNavigate('annual-planner')}>
          <div className="mt-3 grid grid-cols-2 divide-x divide-slate-200 text-center">
            <div className="px-2">
              <div className="text-[9px] font-black text-slate-600">Upcoming Events</div>
              <div className="mt-1 text-base font-black text-emerald-700">{formatNumber(loading ? 0 : upcomingEvents.length)}</div>
            </div>
            <div className="px-2">
              <div className="text-[9px] font-black text-slate-600">Duties</div>
              <div className="mt-1 text-base font-black text-[#06285a]">{formatNumber(loading ? 0 : dutyCount)}</div>
            </div>
          </div>
        </WorkflowCard>
      </div>
    </div>
  );
};

export default TeacherMobileDashboard;
