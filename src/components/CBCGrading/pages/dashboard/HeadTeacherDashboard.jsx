/**
 * Head Teacher Dashboard
 * Academic oversight - focused on academics, attendance, and teacher management
 */

import React, { useEffect, useState, Suspense } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar } from 'recharts';
import { dashboardAPI } from '../../../../services/api';
import {
  AppCard,
  KpiCard,
  SectionHeader,
  EmptyState
} from '@/design-system/components';

import {
  TrendingUp,
  AlertTriangle,
  GraduationCap,
  Users,
  Calendar,
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';

// Intelligence Engine Widgets
import AIInsights from '../../widgets/AIInsights';
import RiskAlerts from '../../widgets/RiskAlerts';
import AttendanceAnomalies from '../../widgets/AttendanceAnomalies';
import AcademicInsights from '../../widgets/AcademicInsights';

const HeadTeacherDashboard = ({ learners = [], teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;

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
      : 92,
    attendanceRate: metrics?.stats?.presentToday && (metrics.stats.presentToday + metrics.stats.absentToday)
      ? Math.round((metrics.stats.presentToday / (metrics.stats.presentToday + metrics.stats.absentToday)) * 100)
      : 88,
    teacherAttendanceRate: 95,
    atRiskStudents: metrics?.stats?.atRiskStudents || 0,
  };

  // Attendance trend data (weekly)
  const attendanceTrendData = [
    { week: 'W1', students: 85, teachers: 98, target: 90 },
    { week: 'W2', students: 87, teachers: 96, target: 90 },
    { week: 'W3', students: stats.attendanceRate, teachers: stats.teacherAttendanceRate, target: 90 },
    { week: 'W4', students: 86, teachers: 97, target: 90 },
    { week: 'W5', students: 88, teachers: 98, target: 90 },
  ];

  // Assessment completion data
  const assessmentData = [
    { grade: 'Grade 1', completed: 95, pending: 5 },
    { grade: 'Grade 2', completed: 92, pending: 8 },
    { grade: 'Grade 3', completed: 89, pending: 11 },
    { grade: 'Grade 4', completed: 94, pending: 6 },
    { grade: 'Grade 5', completed: 88, pending: 12 },
    { grade: 'Grade 6', completed: 91, pending: 9 },
  ];

  // Classes requiring attention
  const classesNeedingAttention = [
    { grade: 'Grade 3', issue: 'Low assessment completion (89%)', severity: 'medium', students: 28 },
    { grade: 'Grade 5', issue: 'High absence rate (18% absent)', severity: 'high', students: 32 },
    { grade: 'Grade 2', issue: 'Teacher coverage gaps', severity: 'medium', students: 26 },
  ];

  // Teacher attendance by department
  const teacherAttendanceByDept = [
    { dept: 'Mathematics', rate: 98, absent: 0 },
    { dept: 'English', rate: 96, absent: 1 },
    { dept: 'Science', rate: 95, absent: 1 },
    { dept: 'Social Studies', rate: 97, absent: 0 },
    { dept: 'PE/Sports', rate: 93, absent: 1 },
  ];

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

      {/* Minimal header - no large colored banner */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Head Teacher Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Academic oversight and performance monitoring</p>
      </div>

      {/* Key Academic Metrics */}
      <div className="space-y-4">
        <SectionHeader 
          variant="default"
          title="Academic Metrics"
          level="h3"
        />
        
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard 
            variant="primary"
            label="Students"
            value={stats.totalLearners}
            subvalue="Total enrolled"
            icon={<GraduationCap size={20} />}
            onClick={() => onNavigate('learners-list')}
          />
          
          <KpiCard 
            variant="success"
            label="Teachers"
            value={stats.totalTeachers}
            subvalue="Active staff"
            icon={<Users size={20} />}
            onClick={() => onNavigate('teachers-list')}
          />
          
          <KpiCard 
            variant="neutral"
            label="Assessment Rate"
            value={`${stats.assessmentRate}%`}
            subvalue="Completion"
            icon={<CheckCircle size={20} />}
            onClick={() => onNavigate('assess-summative-assessment')}
          />
          
          <KpiCard 
            variant="warning"
            label="At-Risk"
            value={stats.atRiskStudents}
            subvalue="Requiring support"
            icon={<AlertTriangle size={20} />}
            onClick={() => onNavigate('learners-list')}
          />
        </div>
      </div>

      {/* Academic Health Score */}
      <AppCard 
        title="Academic Health Score"
        subtitle="Overall assessment of academic performance"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">Overall Health</p>
            <p className="mt-3 text-5xl font-bold text-brand-purple">
              {Math.round((stats.assessmentRate + stats.attendanceRate + stats.totalAssessedClasses * 100 / stats.totalLearners) / 3)}
            </p>
            <p className="mt-2 text-xs text-gray-500">out of 100 - Based on assessment, attendance, and class performance</p>
          </div>
          <div className="flex flex-col gap-4">
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

      {/* Assessment Completion & Attendance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Assessment Completion"
          subtitle="By grade level"
        >
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
        </AppCard>

        <AppCard 
          title="Attendance Trends"
          subtitle="Student vs teacher weekly comparison"
        >
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
        </AppCard>
      </div>

      {/* Teacher Attendance */}
      <AppCard 
        title="Teacher Attendance"
        subtitle="Department-wise attendance rates"
      >
        <div className="space-y-3">
          {teacherAttendanceByDept.map((dept) => (
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
          ))}
        </div>
      </AppCard>

      {/* Classes Requiring Attention */}
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

      {/* AI Academic Insights Placeholder */}
      <AppCard 
        variant="elevated"
        title="AI Academic Insights Placeholder"
        subtitle="Predictive analytics and recommendations coming soon"
      >
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-purple/10 rounded-full mb-4">
            <Brain size={32} className="text-brand-purple" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Zawadi AI Academic Engine</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Student performance predictions and personalized intervention recommendations will appear here once configured. 
            Currently analyzing assessment patterns and attendance correlations.
          </p>
          <button
            onClick={() => onNavigate('settings-academic')}
            className="mt-6 px-6 py-2 bg-brand-purple text-white rounded-lg font-semibold text-sm hover:bg-brand-purple/90 transition"
          >
            Configure AI Features
          </button>
        </div>
      </AppCard>

      {/* Quick Navigation */}
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

      {/* Intelligence Engine Section */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-6">School Intelligence</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Alerts */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <RiskAlerts contextType="school" contextId="default" />
          </Suspense>

          {/* Academic Insights */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <AcademicInsights contextType="school" contextId="default" />
          </Suspense>

          {/* Attendance Anomalies */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <AttendanceAnomalies contextType="school" contextId="default" />
          </Suspense>

          {/* AI Insights */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <AIInsights contextType="school" contextId="default" />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default HeadTeacherDashboard;
