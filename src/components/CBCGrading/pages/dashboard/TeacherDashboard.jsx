/**
 * Teacher Dashboard
 * Daily teaching workflow - focused on classes, attendance, assessments, and learner management
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';
import {
  AppCard,
  EmptyState
} from '@/design-system/components';
import DashboardSummary, { DashboardGreetingBanner } from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import AdminOverviewTabs from './AdminOverviewTabs';

import {
  Clock,
  AlertTriangle,
  BookOpen,
  Users,
  MessageSquare,
  CheckCircle2,
  Calendar,
  FileText,
  ChevronRight,
  AlertCircle,
  ClipboardList,
  GraduationCap
} from 'lucide-react';

// ─── Shared status-badge util ────────────────────────────────────────────────
// Maps a class schedule status to its Tailwind colour classes and display label.
// Kept here (co-located with TeacherDashboard) rather than in the global
// StatusBadge because these are teacher-schedule-specific values; if another
// dashboard ever needs them, extract to shared/classStatusUtils.js at that point.
export const CLASS_STATUS_CONFIG = {
  'in-progress': {
    cardClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'text-blue-700 bg-blue-100',
    label: 'Now',
  },
  upcoming: {
    cardClass: 'bg-amber-50 border-amber-200',
    badgeClass: 'text-amber-700 bg-amber-100',
    label: 'Next',
  },
  scheduled: {
    cardClass: 'bg-gray-50 border-gray-200',
    badgeClass: 'text-gray-600 bg-gray-100',
    label: 'Later',
  },
};

const ClassStatusBadge = ({ status }) => {
  const config = CLASS_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded ${config.badgeClass}`}>
      {config.label}
    </span>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const TeacherDashboard = ({ user, onNavigate }) => {
  const rolePreview = useRolePreview();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('teacher', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Classes, attendance, marking, learners' },
    { id: 'todays-classes', label: "Today's Classes", description: 'Scheduled teaching blocks' },
    { id: 'attendance-assessments', label: 'Attendance & Assessments', description: 'Pending attendance and marking' },
    { id: 'upcoming-lessons', label: 'Upcoming Lessons', description: 'Next scheduled lessons' },
    { id: 'messages-attention', label: 'Messages & Learner Attention', description: 'Communication and support needs' },
    { id: 'quick-actions', label: 'Quick Actions', description: 'Common teacher actions' },
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
        setApiError(null);
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

  const formatDate = (value) => {
    if (!value) return 'No due date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString();
  };

  const todaysClasses = (metrics?.schedule || []).map((item) => ({
    ...item,
    status: item.status || 'scheduled',
    learners: Number(item.learners || 0),
  }));

  const attendanceDue = (metrics?.attendanceDue || []).map((item) => ({
    ...item,
    learners: Number(item.learners || 0),
    marked: Number(item.marked || 0),
  }));

  const assessmentsToMark = (metrics?.assessmentsToMark || []).map((item) => ({
    ...item,
    count: Number(item.count || 1),
  }));

  const upcomingLessons = todaysClasses.slice(0, 3).map((lesson) => ({
    ...lesson,
    date: lesson.day || 'Today',
    topic: lesson.notes || lesson.subject,
  }));

  const messages = metrics?.messages || [];
  const learnersNeedingAttention = metrics?.learnersNeedingAttention || [];

  // Derived KPI values
  const totalLearners = metrics?.stats?.myStudents ?? todaysClasses.reduce((sum, c) => sum + c.learners, 0);
  const totalPapers   = metrics?.stats?.pendingTasks ?? assessmentsToMark.reduce((sum, a) => sum + a.count, 0);

  const getSeverityColor = (severity) =>
    severity === 'high' ? 'border-l-rose-500 bg-rose-50' : 'border-l-amber-500 bg-amber-50';

  const getSeverityTextColor = (severity) =>
    severity === 'high' ? 'text-rose-900' : 'text-amber-900';

  if (loading) {
    return <div className="animate-pulse space-y-6"><div className="h-96 bg-gray-200 rounded-xl" /></div>;
  }

  if (apiError && !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{
          label: 'Retry',
          onClick: loadMetrics
        }}
      />
    );
  }

  return (
    <div className="space-y-6">

      <DashboardGreetingBanner user={user} fallbackName="Teacher" />

      <DashboardSection id="executive-summary" controls={sectionControls}>
      <DashboardSummary
        title="Executive Summary"
        description="The teacher's daily workload at a glance."
        items={[
          {
            label: "Today's Classes",
            value: todaysClasses.length,
            subvalue: 'scheduled',
            icon: <Calendar size={26} />,
            tone: 'indigo',
            onClick: () => onNavigate('planner-timetable'),
          },
          {
            label: 'Attendance Due',
            value: attendanceDue.length,
            subvalue: 'pending',
            icon: <Clock size={26} />,
            tone: 'amber',
            onClick: () => onNavigate('attendance-daily'),
          },
          {
            label: 'Papers to Mark',
            value: totalPapers,
            subvalue: 'total',
            icon: <ClipboardList size={26} />,
            tone: 'purple',
            onClick: () => onNavigate('assess-summative-assessment'),
          },
          {
            label: 'My Learners',
            value: totalLearners,
            subvalue: 'across classes',
            icon: <GraduationCap size={26} />,
            tone: 'emerald',
            onClick: () => onNavigate('learners-list'),
          },
        ]}
      />
      </DashboardSection>

      {/* ── Today's Classes ────────────────────────────────────────────── */}
      <DashboardSection id="todays-classes" controls={sectionControls}>
      <AppCard
        title="Today's Classes"
        subtitle={`${todaysClasses.length} classes scheduled`}
      >
        <div className="space-y-2">
          {todaysClasses.length > 0 ? (
            todaysClasses.map((cls) => {
              const details = [
                cls.time,
                cls.duration ? `${cls.duration} min` : null,
                `${cls.learners} learners`,
              ].filter(Boolean).join(' • ');
              return (
                <button
                  key={cls.id}
                  onClick={() => onNavigate('planner-timetable')}
                  className={`w-full p-4 rounded-lg border transition-all text-left hover:shadow-md ${CLASS_STATUS_CONFIG[cls.status]?.cardClass ?? 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{cls.grade}</h4>
                        <ClassStatusBadge status={cls.status} />
                      </div>
                      <p className="text-sm text-gray-600">{cls.subject}</p>
                      <p className="text-xs text-gray-500 mt-1">{details}</p>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState icon={<Calendar size={40} />} title="No classes found" description="Assigned classes will appear here." />
          )}
        </div>
        <button
          onClick={() => onNavigate('planner-timetable')}
          className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
        >
          View Full Timetable →
        </button>
      </AppCard>
      </DashboardSection>

      {/* ── Attendance Due & Assessments to Mark ───────────────────────── */}
      <DashboardSection id="attendance-assessments" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard
          title="Attendance Due"
          subtitle={`${attendanceDue.length} classes pending`}
        >
          <div className="space-y-2">
            {attendanceDue.length > 0 ? (
              attendanceDue.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate('attendance-daily')}
                  className="w-full p-4 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.grade}</h4>
                      <p className="text-sm text-gray-600">{item.subject}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {[item.time, `${item.marked}/${item.learners} marked`].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <AlertCircle size={20} className="text-amber-600" />
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon={<CheckCircle2 size={40} />} title="All caught up!" description="No pending attendance" />
            )}
          </div>
          <button
            onClick={() => onNavigate('attendance-daily')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            Mark Attendance →
          </button>
        </AppCard>

        <AppCard
          title="Assessments to Mark"
          subtitle={`${totalPapers} total papers`}
        >
          <div className="space-y-2">
            {assessmentsToMark.length > 0 ? (
              assessmentsToMark.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate('assess-summative-assessment')}
                  className="w-full p-4 rounded-lg border border-slate-200 bg-white hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-600">{item.grade}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {[item.learnerName, item.subject, `Due ${formatDate(item.dueDate)}`].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-brand-purple">{item.count}</span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon={<CheckCircle2 size={40} />} title="No draft assessments" description="Pending marking will appear here." />
            )}
          </div>
          <button
            onClick={() => onNavigate('assess-summative-assessment')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Assessments →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* ── Upcoming Lessons ───────────────────────────────────────────── */}
      <DashboardSection id="upcoming-lessons" controls={sectionControls}>
      <AppCard
        title="Upcoming Lessons"
        subtitle="Next 3 scheduled lessons"
      >
        <div className="space-y-2">
          {upcomingLessons.length > 0 ? (
            upcomingLessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onNavigate('assess-learning-areas')}
                className="w-full p-4 rounded-lg border border-slate-200 hover:bg-gray-50 transition text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <BookOpen size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">{lesson.date}</p>
                      <p className="text-xs font-semibold text-gray-500">{lesson.time}</p>
                    </div>
                    <h4 className="font-semibold text-gray-900 mt-1">{lesson.subject}</h4>
                    <p className="text-sm text-gray-600">{lesson.topic}</p>
                    <p className="text-xs text-gray-500 mt-1">{lesson.grade}</p>
                  </div>
                  <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))
          ) : (
            <EmptyState icon={<BookOpen size={40} />} title="No lessons scheduled" description="Timetable lessons will appear here." />
          )}
        </div>
        <button
          onClick={() => onNavigate('planner-timetable')}
          className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
        >
          View All Lessons →
        </button>
      </AppCard>
      </DashboardSection>

      {/* ── Messages & Learners Needing Attention ──────────────────────── */}
      <DashboardSection id="messages-attention" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard
          title="Messages"
          subtitle={`${messages.length} messages`}
        >
          <div className="space-y-2">
            {messages.length > 0 ? (
              messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => onNavigate('comm-notices')}
                  className="w-full p-4 rounded-lg border border-slate-200 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 flex-shrink-0">
                      <MessageSquare size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{msg.subject}</h4>
                      <p className="text-xs text-gray-500 mt-1">From: {msg.from}</p>
                      <p className="text-xs text-gray-400 mt-1">{msg.time}</p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon={<MessageSquare size={40} />} title="No message feed connected" description="There is no teacher dashboard messages data source yet." />
            )}
          </div>
          <button
            onClick={() => onNavigate('comm-notices')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Messages →
          </button>
        </AppCard>

        <AppCard
          title="Learners Requiring Attention"
          subtitle={`${learnersNeedingAttention.length} students`}
        >
          <div className="space-y-2">
            {learnersNeedingAttention.length > 0 ? (
              learnersNeedingAttention.map((learner, idx) => (
                <button
                  key={learner.id || idx}
                  onClick={() => onNavigate('learners-list')}
                  className={`w-full p-4 rounded-lg border-l-4 transition-all hover:shadow-md ${getSeverityColor(learner.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className={`font-semibold text-sm ${getSeverityTextColor(learner.severity)}`}>
                        {learner.name}
                      </h4>
                      <p className={`text-xs mt-1 ${getSeverityTextColor(learner.severity)}`}>
                        {learner.issue}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">{learner.grade}</p>
                    </div>
                    <ChevronRight size={20} className={learner.severity === 'high' ? 'text-rose-500' : 'text-amber-500'} />
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon={<AlertTriangle size={40} />} title="No learner risk feed connected" description="Learners requiring attention need a backend data source." />
            )}
          </div>
          <button
            onClick={() => onNavigate('learners-list')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Learners →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <DashboardSection id="quick-actions" controls={sectionControls}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('attendance-daily')}
          className="p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition text-center"
        >
          <Clock size={24} className="mx-auto text-blue-600 mb-2" />
          <p className="text-xs font-semibold text-gray-900">Mark Attendance</p>
        </button>
        <button
          onClick={() => onNavigate('assess-summative-assessment')}
          className="p-4 rounded-lg border border-slate-200 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition text-center"
        >
          <FileText size={24} className="mx-auto text-brand-purple mb-2" />
          <p className="text-xs font-semibold text-gray-900">Grade Papers</p>
        </button>
        <button
          onClick={() => onNavigate('planner-timetable')}
          className="p-4 rounded-lg border border-slate-200 hover:border-amber-200 hover:bg-amber-50 transition text-center"
        >
          <Calendar size={24} className="mx-auto text-amber-600 mb-2" />
          <p className="text-xs font-semibold text-gray-900">View Timetable</p>
        </button>
        <button
          onClick={() => onNavigate('learners-list')}
          className="p-4 rounded-lg border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 transition text-center"
        >
          <Users size={24} className="mx-auto text-emerald-600 mb-2" />
          <p className="text-xs font-semibold text-gray-900">Learners</p>
        </button>
      </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default TeacherDashboard;
