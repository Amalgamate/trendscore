/**
 * Curriculum Head Dashboard
 * Curriculum oversight with academic/curriculum tools rather than general head-teacher operations.
 */

import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { dashboardAPI } from '../../../../services/api';
import { AppCard, EmptyState } from '@/design-system/components';
import DashboardSummary, { DashboardGreetingBanner } from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import AdminOverviewTabs from './AdminOverviewTabs';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ClipboardList,
  GraduationCap,
  Layers,
  BookOpen,
  Users,
} from 'lucide-react';

const CurriculumHeadDashboard = ({ learners = [], teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('curriculum-head', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Curriculum health snapshot' },
    { id: 'curriculum-health', label: 'Curriculum Health', description: 'Coverage and completion indicators' },
    { id: 'assessment-coverage', label: 'Assessment Coverage', description: 'Completion by grade' },
    { id: 'curriculum-actions', label: 'Curriculum Actions', description: 'Curriculum management shortcuts' },
  ]);

  const loadMetrics = async (filter = 'term') => {
    try {
      setRefreshing(true);
      setApiError(null);
      const response = await dashboardAPI.getAdminMetrics(filter);
      if (response.success) setMetrics(response.data);
      else setApiError(response.message || 'Failed to load dashboard data');
    } catch (error) {
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics('term');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const stats = {
    totalLearners: metrics?.stats?.activeStudents || learners.filter(l => l.status === 'ACTIVE').length || 0,
    totalTeachers: metrics?.stats?.activeTeachers || teachers.filter(t => t.status === 'ACTIVE').length || 0,
    totalAssessedClasses: metrics?.stats?.totalAssessedClasses || 0,
    totalMissedExams: metrics?.stats?.totalMissedExams || 0,
    totalStudents: metrics?.stats?.totalStudents || learners.length || 0,
    currentTestSeries: metrics?.stats?.currentTestSeries || 'Current Series',
  };

  const assessmentRate = stats.totalStudents > 0
    ? Math.round(((stats.totalStudents - stats.totalMissedExams) / stats.totalStudents) * 100)
    : 0;
  const curriculumCoverage = stats.totalLearners > 0
    ? Math.min(100, Math.round((stats.totalAssessedClasses * 100) / stats.totalLearners))
    : 0;
  const curriculumHealth = Math.round((assessmentRate + curriculumCoverage) / 2);

  const assessmentData = (metrics?.unAssessedBreakdown || []).map((item) => {
    const total = Number(item.total || 0);
    const assessed = Number(item.assessed || 0);
    const unAssessed = Number(item.unAssessed || 0);
    return {
      grade: item.grade,
      assessed: total > 0 ? Math.round((assessed / total) * 100) : 0,
      pending: total > 0 ? Math.round((unAssessed / total) * 100) : 0,
    };
  });

  if (apiError && !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{ label: 'Retry', onClick: () => loadMetrics('term') }}
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
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">Syncing curriculum data...</p>
        </div>
      )}

      <DashboardGreetingBanner user={user} />

      <DashboardSection id="executive-summary" controls={sectionControls}>
        <DashboardSummary
          title="Executive Summary"
          description="Curriculum delivery and assessment readiness at a glance."
          items={[
            { label: 'Learners', value: stats.totalLearners, subvalue: 'active learners', icon: <GraduationCap size={26} />, tone: 'indigo', onClick: () => onNavigate('learners-list') },
            { label: 'Teachers', value: stats.totalTeachers, subvalue: 'curriculum delivery staff', icon: <Users size={26} />, tone: 'purple', onClick: () => onNavigate('teachers-list') },
            { label: 'Assessment Rate', value: `${assessmentRate}%`, subvalue: stats.currentTestSeries, icon: <CheckCircle size={26} />, tone: 'emerald', onClick: () => onNavigate('assess-summary-report') },
            { label: 'Pending Learners', value: stats.totalMissedExams, subvalue: 'unassessed', icon: <AlertTriangle size={26} />, tone: stats.totalMissedExams > 0 ? 'orange' : 'teal', onClick: () => onNavigate('assess-summary-report') },
          ]}
        />
      </DashboardSection>

      <DashboardSection id="curriculum-health" controls={sectionControls}>
        <AppCard title="Curriculum Health" subtitle="Coverage and completion indicators">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Overall Health</p>
              <p className="mt-2 text-4xl font-black text-indigo-900">{curriculumHealth}%</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Assessment Completion</p>
              <p className="mt-2 text-4xl font-black text-emerald-900">{assessmentRate}%</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Class Coverage</p>
              <p className="mt-2 text-4xl font-black text-amber-900">{curriculumCoverage}%</p>
            </div>
          </div>
        </AppCard>
      </DashboardSection>

      <DashboardSection id="assessment-coverage" controls={sectionControls}>
        <AppCard title="Assessment Coverage" subtitle="Assessed and pending learners by grade">
          {assessmentData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assessmentData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="assessed" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<BarChart3 size={40} />} title="No assessment coverage yet" description="Coverage appears after assessment results are recorded." />
          )}
        </AppCard>
      </DashboardSection>

      <DashboardSection id="curriculum-actions" controls={sectionControls}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Learning Areas', icon: BookOpen, path: 'assess-learning-areas', tone: 'text-indigo-600 hover:border-indigo-500/50 hover:bg-indigo-50' },
            { label: 'Schemes of Work', icon: ClipboardList, path: 'planner-schemes', tone: 'text-emerald-600 hover:border-emerald-500/50 hover:bg-emerald-50' },
            { label: 'Assessments', icon: BarChart3, path: 'assess-summative-assessment', tone: 'text-brand-purple hover:border-brand-purple/50 hover:bg-brand-purple/5' },
            { label: 'Academic Settings', icon: Layers, path: 'settings-academic', tone: 'text-amber-600 hover:border-amber-500/50 hover:bg-amber-50' },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.path)}
              className={`rounded-lg border border-slate-200 p-4 text-center transition ${action.tone}`}
            >
              <action.icon size={24} className="mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-900">{action.label}</p>
            </button>
          ))}
        </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default CurriculumHeadDashboard;
