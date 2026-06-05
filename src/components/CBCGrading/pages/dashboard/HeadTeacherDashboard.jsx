/**
 * Head Teacher Dashboard
 * Academic oversight - focused on academics, attendance, and teacher management
 */

import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar } from 'recharts';
import { dashboardAPI } from '../../../../services/api';
import {
  AppCard,
  EmptyState
} from '@/design-system/components';
import DashboardSummary, { DashboardGreetingBanner } from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';

import {
  TrendingUp,
  AlertTriangle,
  GraduationCap,
  Users,
  Calendar,
  BookOpen,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';


const HeadTeacherDashboard = ({ learners = [], teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('head-teacher', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Students, staff, assessment, and risk' },
    { id: 'health-attendance', label: 'Health & Attendance', description: 'Academic health and teacher attendance' },
    { id: 'assessment-trends', label: 'Assessment & Trends', description: 'Completion and attendance trend charts' },
    { id: 'classes-attention', label: 'Classes Requiring Attention', description: 'Classes needing intervention' },
    { id: 'quick-navigation', label: 'Quick Navigation', description: 'Common academic actions' },
  ]);

  const loadMetrics = async (filter = 'term') => {
    try {
      setRefreshing(true);
      setApiError(null);
      const response = await dashboardAPI.getAdminMetrics(filter);
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics('term');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Compute academic stats
  const stats = {
    totalLearners: metrics?.stats?.activeStudents || learners.filter(l => l.status === 'ACTIVE').length || 0,
    totalTeachers: metrics?.stats?.activeTeachers || teachers.filter(t => t.status === 'ACTIVE').length || 0,
    presentToday: metrics?.stats?.presentToday || 0,
    totalAssessedClasses: metrics?.stats?.totalAssessedClasses || 0,
    totalMissedExams: metrics?.stats?.totalMissedExams || 0,
    assessmentRate: metrics?.stats?.totalStudents > 0 
      ? Math.round(((metrics.stats.totalStudents - metrics.stats.totalMissedExams) / metrics.stats.totalStudents) * 100)
      : 0,
    attendanceRate: metrics?.stats && (metrics.stats.presentToday + metrics.stats.absentToday) > 0
      ? Math.round((metrics.stats.presentToday / (metrics.stats.presentToday + metrics.stats.absentToday)) * 100)
      : 0,
    teacherAttendanceRate: metrics?.stats?.totalTeachers > 0
      ? Math.round((metrics.stats.activeTeachers / metrics.stats.totalTeachers) * 100)
      : 0,
    atRiskStudents: metrics?.stats?.atRiskStudents || 0,
  };

  const attendanceTrendData = metrics?.attendanceTrend || [];

  const assessmentData = (metrics?.unAssessedBreakdown || []).map((item) => {
    const total = Number(item.total || 0);
    const assessed = Number(item.assessed || 0);
    const unAssessed = Number(item.unAssessed || 0);
    return {
      grade: item.grade,
      completed: total > 0 ? Math.round((assessed / total) * 100) : 0,
      pending: total > 0 ? Math.round((unAssessed / total) * 100) : 0,
    };
  });

  const classesNeedingAttention = (metrics?.unAssessedBreakdown || [])
    .filter((item) => Number(item.unAssessed || 0) > 0)
    .map((item) => ({
      grade: item.grade,
      issue: `${item.unAssessed} learners pending assessment completion`,
      severity: Number(item.unAssessed || 0) > 10 ? 'high' : 'medium',
      students: item.total,
    }));

  const teacherAttendanceByDept = metrics?.teacherAttendanceByDept || [];
  const classCoverage = stats.totalLearners > 0
    ? Math.min(100, Math.round((stats.totalAssessedClasses * 100) / stats.totalLearners))
    : 0;
  const academicHealthScore = Math.round((stats.assessmentRate + stats.attendanceRate + classCoverage) / 3);

  if (apiError && !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{
          label: 'Retry',
          onClick: () => loadMetrics('term')
        }}
      />
    );
  }

  if (refreshing && !metrics) {
    return <div className="animate-pulse space-y-6"><div className="h-96 bg-gray-200 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">
            Syncing academic data...
          </p>
        </div>
      )}

      <DashboardGreetingBanner user={user} />

      <DashboardSection id="executive-summary" controls={sectionControls}>
      <DashboardSummary
        title="Executive Summary"
        description="The four numbers that need the head teacher's first glance."
        items={[
          {
            label: 'Students',
            value: stats.totalLearners,
            subvalue: 'Total enrolled',
            icon: <GraduationCap size={26} />,
            tone: 'indigo',
            onClick: () => onNavigate('learners-list'),
          },
          {
            label: 'Staff',
            value: stats.totalTeachers,
            subvalue: 'Active teaching staff',
            icon: <Users size={26} />,
            tone: 'purple',
            onClick: () => onNavigate('teachers-list'),
          },
          {
            label: 'Assessment Rate',
            value: `${stats.assessmentRate}%`,
            subvalue: 'Completion',
            icon: <CheckCircle size={26} />,
            tone: 'emerald',
            onClick: () => onNavigate('assess-summative-assessment'),
          },
          {
            label: 'At-Risk',
            value: stats.atRiskStudents,
            subvalue: 'Requiring support',
            icon: <AlertTriangle size={26} />,
            tone: 'orange',
            onClick: () => onNavigate('learners-list'),
          },
        ]}
      />
      </DashboardSection>

      <DashboardSection id="health-attendance" controls={sectionControls}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Academic Health Score */}
        <AppCard
          title="Academic Health Score"
          subtitle="Overall assessment of academic performance"
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">Overall Health</p>
              <p className="mt-3 text-5xl font-bold text-brand-purple">
                {academicHealthScore}
              </p>
              <p className="mt-2 text-xs text-gray-500">out of 100 - Based on assessment, attendance, and class performance</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold uppercase">Assessment</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{stats.assessmentRate}%</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-emerald-600 font-semibold uppercase">Attendance</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.attendanceRate}%</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-600 font-semibold uppercase">Classes Assessed</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">{stats.totalAssessedClasses}</p>
              </div>
            </div>
          </div>
        </AppCard>

        {/* Teacher Attendance */}
        <AppCard
          title="Teacher Attendance"
          subtitle="Subject-wise attendance rates"
        >
          <div className="space-y-3">
            {teacherAttendanceByDept.length > 0 ? teacherAttendanceByDept.map((dept) => (
              <div key={dept.dept} className="p-3 rounded-lg border border-slate-100 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">{dept.dept}</h4>
                    <p className="text-xs text-gray-500 mt-1">{dept.absent > 0 ? `${dept.absent} absent` : 'All present'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-8 bg-gray-100 rounded-full relative overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${dept.rate}%` }}
                      />
                    </div>
                    <p className="text-lg font-bold text-gray-900 min-w-12 text-right">{dept.rate}%</p>
                  </div>
                </div>
              </div>
            )) : (
              <EmptyState icon={<Clock size={40} />} title="No teacher attendance yet" description="Teacher clock-in records will appear here after staff attendance is marked." />
            )}
          </div>
        </AppCard>
      </div>
      </DashboardSection>

      {/* Assessment Completion & Attendance Trends */}
      <DashboardSection id="assessment-trends" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Assessment Completion"
          subtitle="By grade level"
        >
          {assessmentData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assessmentData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="completed" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pending" fill="#fbbf24" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<CheckCircle size={40} />} title="No assessment series data" description="Grade completion appears after a summative test series has results." />
          )}
        </AppCard>

        <AppCard 
          title="Attendance Trends"
          subtitle="Student vs teacher weekly comparison"
        >
          {attendanceTrendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[80, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Line type="monotone" dataKey="students" stroke="#8b5cf6" strokeWidth={2} />
                  <Line type="monotone" dataKey="teachers" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="target" stroke="#cbd5e1" strokeDasharray="5 5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<TrendingUp size={40} />} title="No attendance trend feed" description="The dashboard API currently returns today's attendance only, not weekly trend points." />
          )}
        </AppCard>
      </div>
      </DashboardSection>

      {/* Classes Requiring Attention */}
      <DashboardSection id="classes-attention" controls={sectionControls}>
      {classesNeedingAttention.length > 0 && (
        <AppCard 
          variant="flat"
          title="Classes Requiring Attention"
          subtitle="Performance concerns and intervention needs"
        >
          <div className="space-y-3">
            {classesNeedingAttention.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate('learners-list')}
                className={`w-full text-left p-4 rounded-lg border-l-4 transition-all hover:shadow-md ${
                  item.severity === 'high' 
                    ? 'border-l-rose-500 bg-rose-50 hover:bg-rose-100' 
                    : 'border-l-amber-500 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`font-semibold text-sm ${
                      item.severity === 'high' ? 'text-rose-900' : 'text-amber-900'
                    }`}>
                      {item.grade}
                    </h4>
                    <p className={`text-xs mt-1 ${
                      item.severity === 'high' ? 'text-rose-700' : 'text-amber-700'
                    }`}>
                      {item.issue}
                    </p>
                    <p className={`text-xs mt-2 font-medium ${
                      item.severity === 'high' ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {item.students} students
                    </p>
                  </div>
                  <div className={`text-2xl font-bold ${
                    item.severity === 'high' ? 'text-rose-500' : 'text-amber-500'
                  }`}>
                    →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </AppCard>
      )}
      </DashboardSection>

      {/* Quick Navigation */}
      <DashboardSection id="quick-navigation" controls={sectionControls}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('assess-summative-assessment')}
          className="p-4 rounded-lg border border-slate-200 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition text-center"
        >
          <BarChart3 size={24} className="mx-auto text-brand-purple mb-2" />
          <p className="text-xs font-semibold text-gray-900">Assessments</p>
        </button>
        <button
          onClick={() => onNavigate('attendance-daily')}
          className="p-4 rounded-lg border border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50 transition text-center"
        >
          <Calendar size={24} className="mx-auto text-emerald-600 mb-2" />
          <p className="text-xs font-semibold text-gray-900">Attendance</p>
        </button>
        <button
          onClick={() => onNavigate('teachers-list')}
          className="p-4 rounded-lg border border-slate-200 hover:border-blue-500/50 hover:bg-blue-50 transition text-center"
        >
          <Users size={24} className="mx-auto text-blue-600 mb-2" />
          <p className="text-xs font-semibold text-gray-900">Teachers</p>
        </button>
        <button
          onClick={() => onNavigate('assess-learning-areas')}
          className="p-4 rounded-lg border border-slate-200 hover:border-amber-500/50 hover:bg-amber-50 transition text-center"
        >
          <BookOpen size={24} className="mx-auto text-amber-600 mb-2" />
          <p className="text-xs font-semibold text-gray-900">Curriculum</p>
        </button>
      </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default HeadTeacherDashboard;
