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

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Trophy,
  ClipboardList,
  BarChart3,
  Calendar,
  Zap,
  TrendingUp,
  FileText,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Star
} from 'lucide-react';

const StudentDashboard = ({ user, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setApiError(null);
      const response = await dashboardAPI.getStudentMetrics?.() || { success: true, data: {} };
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load student metrics:', error);
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Mock data - learner-focused
  const activeCourses = [
    { id: 1, name: 'Mathematics', teacher: 'Mr. Kipchoge', progress: 85, learners: 28 },
    { id: 2, name: 'English', teacher: 'Mrs. Mwangi', progress: 72, learners: 28 },
    { id: 3, name: 'Science', teacher: 'Dr. Ochieng', progress: 78, learners: 30 },
    { id: 4, name: 'Social Studies', teacher: 'Mr. Kipchoge', progress: 65, learners: 28 },
  ];

  const assignments = [
    { id: 1, course: 'Mathematics', title: 'Chapter 5 Problem Set', dueDate: '2026-06-03', submitted: false, status: 'pending' },
    { id: 2, course: 'English', title: 'Essay - My Holiday', dueDate: '2026-06-04', submitted: true, grade: 'A', status: 'submitted' },
    { id: 3, course: 'Science', title: 'Laboratory Report', dueDate: '2026-06-05', submitted: false, status: 'pending' },
    { id: 4, course: 'Social Studies', title: 'Project - Local History', dueDate: '2026-06-08', submitted: false, status: 'pending' },
  ];

  const upcomingDeadlines = [
    { id: 1, course: 'Mathematics', type: 'Assignment', title: 'Problem Set Chapter 5', date: '2026-06-03', daysLeft: 1, priority: 'high' },
    { id: 2, course: 'Science', type: 'Quiz', title: 'Chapter 3 Quiz', date: '2026-06-04', daysLeft: 2, priority: 'medium' },
    { id: 3, course: 'English', type: 'Project', title: 'Book Review Project', date: '2026-06-06', daysLeft: 4, priority: 'medium' },
  ];

  const quizPerformance = [
    { id: 1, course: 'Mathematics', quiz: 'Functions & Equations', score: 92, date: '2026-05-28' },
    { id: 2, course: 'Science', quiz: 'Photosynthesis', score: 78, date: '2026-05-25' },
    { id: 3, course: 'English', quiz: 'Grammar & Syntax', score: 88, date: '2026-05-22' },
  ];

  const achievements = [
    { id: 1, name: 'Mathematician', description: '4 Perfect Scores', icon: '🏆', earned: true },
    { id: 2, name: 'Scholar', description: '80% Overall Average', icon: '📚', earned: true },
    { id: 3, name: 'Perfect Attendance', description: 'No Missed Days', icon: '✅', earned: true },
    { id: 4, name: 'Speed Reader', description: '5 Completed Readings', icon: '⚡', earned: false },
  ];

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

  const overallProgress = Math.round(activeCourses.reduce((sum, c) => sum + c.progress, 0) / activeCourses.length);
  const avgQuizScore = Math.round(quizPerformance.reduce((sum, q) => sum + q.score, 0) / quizPerformance.length);
  const submittedCount = assignments.filter(a => a.submitted).length;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0] || 'Student'}</h1>
        <p className="text-sm text-gray-600 mt-1">Your learning dashboard for {activeCourses.length} active courses</p>
      </div>

      {/* Learning Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Overall Progress</p>
              <p className="text-3xl font-bold text-brand-purple mt-1">{overallProgress}%</p>
            </div>
            <TrendingUp size={24} className="text-brand-purple opacity-50" />
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Courses</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{activeCourses.length}</p>
            </div>
            <BookOpen size={24} className="text-blue-600 opacity-50" />
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Avg Quiz Score</p>
              <p className={`text-3xl font-bold mt-1 ${getScoreColor(avgQuizScore).split(' ')[0]}`}>{avgQuizScore}%</p>
            </div>
            <BarChart3 size={24} className="text-emerald-600 opacity-50" />
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Submitted</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{submittedCount}/{assignments.length}</p>
            </div>
            <CheckCircle2 size={24} className="text-emerald-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* My Courses & Upcoming Deadlines - Side by Side */}
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

      {/* Assignments & Quiz Performance - Side by Side */}
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

      {/* Attendance & Achievements - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Attendance"
          subtitle="Current term"
        >
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('attendance-analytics')}
              className="w-full p-6 rounded-lg border border-emerald-200 bg-emerald-50 text-center hover:shadow-md transition"
            >
              <div className="flex items-center justify-center mb-3">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <p className="text-4xl font-bold text-emerald-600">94%</p>
              <p className="text-sm text-emerald-700 mt-2">184 days present • 12 days absent</p>
              <p className="text-xs text-emerald-600 font-semibold mt-3">Excellent attendance!</p>
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

      {/* Learning Insights Placeholder */}
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
    </div>
  );
};

export default StudentDashboard;
