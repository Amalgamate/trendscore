/**
 * Student Dashboard
 * Modern learner-focused dashboard with courses, assignments, progress, and achievements
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import {
  AppCard,
  EmptyState
} from '@/design-system/components';
import DashboardSummary from '../dashboard/DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from '../dashboard/DashboardSections';
import { useImpersonation } from '../../../../contexts/ImpersonationContext';

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  BarChart3,
  Zap,
  TrendingUp,
  AlertCircle,
  Info
} from 'lucide-react';

const StudentDashboard = ({ user, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [noLearnerRecord, setNoLearnerRecord] = useState(false);

  const { isImpersonating } = useImpersonation();

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('student', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Progress, courses, scores, submissions' },
    { id: 'courses-deadlines', label: 'Courses & Deadlines', description: 'Courses and upcoming work' },
    { id: 'assignments-performance', label: 'Assignments & Performance', description: 'Submission and quiz performance' },
    { id: 'attendance-achievements', label: 'Attendance & Achievements', description: 'Attendance and earned badges' },
    { id: 'learning-insights', label: 'Learning Insights', description: 'Personalized recommendations' },
  ]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setApiError(null);
      setNoLearnerRecord(false);
      const response = await dashboardAPI.getStudentMetrics?.() || { success: true, data: {} };
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load student metrics:', error);
      // If the student account has no linked learner record (common for test/demo accounts
      // or admin impersonation sessions), show an empty dashboard shell instead of hard error.
      const isLearnerNotFound =
        error?.response?.status === 404 ||
        error?.response?.status === 403 ||
        (error?.message || '').toLowerCase().includes('learner record not found') ||
        (error?.message || '').toLowerCase().includes('unauthorized student');

      if (isLearnerNotFound) {
        setNoLearnerRecord(true);
        setMetrics({});   // empty shell — all arrays/stats default to empty/zero
      } else {
        setApiError(error.message || 'Could not reach the server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const formatDate = (value) => {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeCourses = (metrics?.courses || []).map((course) => ({
    id: course.id || course.courseId,
    name: course.name || course.title || course.subject || 'Course',
    teacher: course.teacher || course.subject || 'Assigned course',
    progress: Number(course.progress ?? course.progressPercent ?? 0),
  }));

  const assignments = (metrics?.assignments || []).map((assignment) => ({
    id: assignment.id,
    course: assignment.course || assignment.courseTitle || 'Course',
    title: assignment.title || 'Assignment',
    dueDate: formatDate(assignment.dueDate || assignment.date),
    submitted: Boolean(assignment.submitted || assignment.status === 'submitted'),
    grade: assignment.grade,
    status: assignment.status,
  }));

  const upcomingDeadlines = (metrics?.upcomingDeadlines || [])
    .map((deadline) => ({
      id: deadline.id,
      course: deadline.course || deadline.courseTitle || 'Course',
      type: deadline.type || 'Assignment',
      title: deadline.title || 'Deadline',
      date: formatDate(deadline.dueDate || deadline.date),
      daysLeft: deadline.daysLeft,
      priority: deadline.priority || 'medium',
    }));

  const quizPerformance = (metrics?.subjects || metrics?.recentSubjects || []).map((item) => ({
    id: item.id,
    course: item.course || item.subject || item.learningArea || item.name || 'Subject',
    quiz: item.quiz || item.title || item.name || 'Assessment',
    score: Number(item.score ?? item.percentage ?? 0),
    date: formatDate(item.date || item.createdAt),
  }));

  const achievements = (metrics?.achievements || []).map((achievement) => ({
    id: achievement.id,
    name: achievement.name || achievement.title || 'Achievement',
    description: achievement.description || '',
    icon: achievement.icon || 'achievement',
    earned: Boolean(achievement.earned),
  }));

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'text-emerald-600 bg-emerald-50';
    if (progress >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-rose-200 bg-rose-50';
      case 'medium': return 'border-amber-200 bg-amber-50';
      default: return 'border-slate-200 bg-white';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high': return <span className="text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-1 rounded">Urgent</span>;
      case 'medium': return <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">Soon</span>;
      default: return null;
    }
  };

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

  const overallProgress = activeCourses.length > 0
    ? Math.round(activeCourses.reduce((sum, c) => sum + c.progress, 0) / activeCourses.length)
    : 0;
  const avgQuizScore = quizPerformance.length > 0
    ? Math.round(quizPerformance.reduce((sum, q) => sum + q.score, 0) / quizPerformance.length)
    : 0;
  const submittedCount = assignments.filter(a => a.submitted).length;

  // Live attendance data from API
  const attendanceRate   = metrics?.stats?.attendanceRate ?? metrics?.stats?.attendance ?? null;
  const attendancePresent = metrics?.stats?.attendancePresent ?? null;
  const attendanceAbsent  = metrics?.stats?.attendanceAbsent  ?? null;
  const attendanceTotal   = metrics?.stats?.attendanceTotal   ?? null;
  const hasAttendance = attendanceTotal !== null && attendanceTotal > 0;

  const getAttendanceBadge = (rate) => {
    if (rate === null) return null;
    if (rate >= 90) return { label: 'Excellent attendance!', color: 'text-emerald-600' };
    if (rate >= 75) return { label: 'Good attendance',       color: 'text-amber-600'  };
    return               { label: 'Needs improvement',       color: 'text-rose-600'   };
  };
  const attendanceBadge = getAttendanceBadge(attendanceRate);

  const attendanceColorClass = attendanceRate === null
    ? 'text-gray-400'
    : attendanceRate >= 90 ? 'text-emerald-600'
    : attendanceRate >= 75 ? 'text-amber-600'
    : 'text-rose-600';

  const attendanceBorderClass = attendanceRate === null
    ? 'border-slate-200 bg-slate-50'
    : attendanceRate >= 90 ? 'border-emerald-200 bg-emerald-50'
    : attendanceRate >= 75 ? 'border-amber-200 bg-amber-50'
    : 'border-rose-200 bg-rose-50';

  return (
    <div className="space-y-6">
      {/* Impersonation notice — shown when the student account has no learner record */}
      {noLearnerRecord && isImpersonating && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">Preview mode — no learner record found.</span>
            {' '}This student account isn't linked to a learner profile yet, so dashboard data is unavailable.
            Enrol the student via the Learners module to populate real data.
          </div>
        </div>
      )}
      <DashboardSection id="executive-summary" controls={sectionControls}>
      <DashboardSummary
        title="Executive Summary"
        description="Your learning progress and workload at a glance."
        items={[
          {
            label: 'Overall Progress',
            value: `${overallProgress}%`,
            subvalue: 'course completion',
            icon: <TrendingUp size={26} />,
            tone: 'indigo',
            onClick: () => onNavigate('student-progress'),
          },
          {
            label: 'Courses',
            value: activeCourses.length,
            subvalue: 'active courses',
            icon: <BookOpen size={26} />,
            tone: 'purple',
            onClick: () => onNavigate('student-courses'),
          },
          {
            label: 'Quiz Score',
            value: `${avgQuizScore}%`,
            subvalue: 'average score',
            icon: <BarChart3 size={26} />,
            tone: avgQuizScore >= 80 ? 'emerald' : 'amber',
          },
          {
            label: 'Submitted',
            value: `${submittedCount}/${assignments.length}`,
            subvalue: 'assignments complete',
            icon: <CheckCircle2 size={26} />,
            tone: 'teal',
            onClick: () => onNavigate('student-assignments'),
          },
        ]}
      />
      </DashboardSection>

      {/* My Courses & Upcoming Deadlines - Side by Side */}
      <DashboardSection id="courses-deadlines" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="My Courses"
          subtitle={`${activeCourses.length} active courses`}
        >
          <div className="space-y-2">
            {activeCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => onNavigate('student-course-view')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${getProgressColor(course.progress)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">{course.name}</h4>
                    <p className="text-xs opacity-75">Teacher: {course.teacher}</p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-full rounded-full ${course.progress >= 80 ? 'bg-emerald-600' : course.progress >= 60 ? 'bg-amber-600' : 'bg-rose-600'}`}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold ml-2">{course.progress}%</span>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('student-courses')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Courses →
          </button>
        </AppCard>

        <AppCard 
          title="Upcoming Deadlines"
          subtitle={`${upcomingDeadlines.length} deadlines ahead`}
        >
          <div className="space-y-2">
            {upcomingDeadlines.map((deadline) => (
              <button
                key={deadline.id}
                onClick={() => onNavigate('student-assignments')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${getPriorityColor(deadline.priority)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs opacity-75 font-semibold">{deadline.course}</p>
                    <h4 className="font-semibold mt-1">{deadline.title}</h4>
                    <p className="text-xs opacity-75 mt-1">{deadline.type} • {deadline.date}</p>
                  </div>
                  {getPriorityBadge(deadline.priority)}
                </div>
                <div className="text-xs font-semibold opacity-75">
                  {deadline.daysLeft === 0 ? 'Due today' : `${deadline.daysLeft} day${deadline.daysLeft !== 1 ? 's' : ''} left`}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('student-assignments')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Deadlines →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* Assignments & Quiz Performance - Side by Side */}
      <DashboardSection id="assignments-performance" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Assignments"
          subtitle={`${submittedCount}/${assignments.length} submitted`}
        >
          <div className="space-y-2">
            {assignments.map((assign) => (
              <button
                key={assign.id}
                onClick={() => onNavigate('student-assignments')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${assign.submitted ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs opacity-75">{assign.course}</p>
                    <h4 className="font-semibold mt-1">{assign.title}</h4>
                    <p className="text-xs opacity-75 mt-1">Due {assign.dueDate}</p>
                  </div>
                  <div className="text-right">
                    {assign.submitted ? (
                      <>
                        <CheckCircle2 size={20} className="text-emerald-600" />
                        {assign.grade && <p className="text-sm font-bold text-emerald-600 mt-1">{assign.grade}</p>}
                      </>
                    ) : (
                      <AlertCircle size={20} className="text-amber-600" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('student-assignments')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Assignments →
          </button>
        </AppCard>

        <AppCard 
          title="Quiz Performance"
          subtitle={`Average: ${avgQuizScore}%`}
        >
          <div className="space-y-2">
            {quizPerformance.map((quiz) => (
              <button
                key={quiz.id}
                onClick={() => onNavigate('student-quizzes')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${getScoreColor(quiz.score)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs opacity-75">{quiz.course}</p>
                    <h4 className="font-semibold mt-1">{quiz.quiz}</h4>
                    <p className="text-xs opacity-75 mt-1">{quiz.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{quiz.score}%</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('student-quizzes')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Quizzes →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* Attendance & Achievements - Side by Side */}
      <DashboardSection id="attendance-achievements" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Attendance"
          subtitle="Current term"
        >
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('attendance-analytics')}
              className={`w-full p-6 rounded-lg border text-center hover:shadow-md transition ${attendanceBorderClass}`}
            >
              <div className="flex items-center justify-center mb-3">
                <CheckCircle2 size={32} className={attendanceColorClass} />
              </div>
              <p className={`text-4xl font-bold ${attendanceColorClass}`}>
                {hasAttendance ? `${attendanceRate}%` : '--'}
              </p>
              {hasAttendance ? (
                <p className={`text-sm mt-2 ${attendanceColorClass}`}>
                  {attendancePresent} day{attendancePresent !== 1 ? 's' : ''} present
                  {attendanceAbsent > 0 ? ` • ${attendanceAbsent} absent` : ''}
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-2">No attendance data yet</p>
              )}
              {attendanceBadge && (
                <p className={`text-xs font-semibold mt-3 ${attendanceBadge.color}`}>
                  {attendanceBadge.label}
                </p>
              )}
            </button>
          </div>
          <button
            onClick={() => onNavigate('attendance-analytics')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View Attendance Details →
          </button>
        </AppCard>

        <AppCard 
          title="Achievements"
          subtitle={`${achievements.filter(a => a.earned).length}/${achievements.length} badges earned`}
        >
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement) => (
              <button
                key={achievement.id}
                onClick={() => onNavigate('student-profile')}
                className={`p-4 rounded-lg border transition-all text-center ${
                  achievement.earned 
                    ? 'border-brand-purple/30 bg-brand-purple/5 hover:shadow-md' 
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <p className="text-3xl mb-2">{achievement.icon}</p>
                <h4 className="text-xs font-semibold text-gray-900">{achievement.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{achievement.description}</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('student-profile')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Achievements →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* Learning Insights Placeholder */}
      <DashboardSection id="learning-insights" controls={sectionControls}>
      <AppCard 
        title="Learning Insights"
        subtitle="AI-powered recommendations"
      >
        <div className="p-8 rounded-lg border border-slate-200 bg-gradient-to-br from-brand-purple/5 to-brand-teal/5 text-center">
          <Zap size={40} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Personalized learning insights coming soon</p>
          <p className="text-xs text-gray-500 mt-2">We're analyzing your learning patterns to provide tailored recommendations and improvement suggestions</p>
        </div>
      </AppCard>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default StudentDashboard;
