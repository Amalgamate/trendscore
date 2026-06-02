/**
 * Executive Admin Dashboard
 * High-level school health metrics and KPIs
 */

import React, { useEffect, useState, Suspense } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts';
import { hasPageAccess } from '../../utils/appAccess';
import {
  AppCard,
  KpiCard,
  SectionHeader,
  DashboardHero,
  EmptyState
} from '@/design-system/components';

import {
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  Activity,
  Brain
} from 'lucide-react';

// Intelligence Engine Widgets
import AIInsights from '../../widgets/AIInsights';
import RiskAlerts from '../../widgets/RiskAlerts';
import FeeCollectionForecast from '../../widgets/FeeCollectionForecast';
import AcademicInsights from '../../widgets/AcademicInsights';

const AdminDashboard = ({ learners = [], pagination, teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const hasInstantData = learners.length > 0 || teachers.length > 0 || (pagination?.total || 0) > 0;

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

  // Compute stats from metrics and local data
  const stats = {
    totalStudents: metrics?.stats?.totalStudents || pagination?.total || learners.length || 0,
    activeStudents: metrics?.stats?.activeStudents || learners.filter(l => l.status === 'ACTIVE').length || 0,
    totalTeachers: metrics?.stats?.totalTeachers || teachers.length || 0,
    activeTeachers: metrics?.stats?.activeTeachers || teachers.filter(t => t.status === 'ACTIVE').length || 0,
    presentToday: metrics?.stats?.presentToday || 0,
    absentToday: metrics?.stats?.absentToday || 0,
    feeCollected: metrics?.stats?.feeCollected || 0,
    feePending: metrics?.stats?.feePending || 0,
    totalMissedExams: metrics?.stats?.totalMissedExams || 0,
    atRiskStudents: metrics?.stats?.atRiskStudents || 0,
    totalAssessedClasses: metrics?.stats?.totalAssessedClasses || 0,
  };

  // Calculate School Health Score (0-100)
  const attendanceRate = stats.totalStudents > 0 
    ? Math.round((stats.presentToday / (stats.presentToday + stats.absentToday || stats.totalStudents)) * 100) 
    : 0;
  const collectionRate = (stats.feeCollected + stats.feePending) > 0
    ? Math.round((stats.feeCollected / (stats.feeCollected + stats.feePending)) * 100)
    : 0;
  const assessmentRate = stats.totalStudents > 0
    ? Math.round(((stats.totalStudents - stats.totalMissedExams) / stats.totalStudents) * 100)
    : 0;
  const healthScore = Math.round((attendanceRate + collectionRate + assessmentRate) / 3);

  // Revenue trend data
  const revenueTrendData = (metrics?.financials?.trendData || []).length > 0 
    ? metrics.financials.trendData 
    : [
        { month: 'Jan', revenue: 450000 },
        { month: 'Feb', revenue: 520000 },
        { month: 'Mar', revenue: 480000 },
        { month: 'Apr', revenue: 610000 },
        { month: 'May', revenue: 580000 },
      ];

  // Attention items
  const attentionItems = [
    stats.totalMissedExams > 0 && {
      title: `${stats.totalMissedExams} Unassessed Students`,
      description: 'Students pending assessment completion',
      severity: 'high',
      action: () => onNavigate('assess-summary-report')
    },
    stats.feePending > 0 && {
      title: `KES ${Math.round(stats.feePending / 1000)}k Outstanding`,
      description: 'Pending fee payments require follow-up',
      severity: 'medium',
      action: () => onNavigate('fees-collection')
    },
    stats.atRiskStudents > 0 && {
      title: `${stats.atRiskStudents} At-Risk Learners`,
      description: 'Students requiring additional support',
      severity: 'high',
      action: () => onNavigate('learners-list')
    }
  ].filter(Boolean);

  // Top performing classes
  const topClasses = (metrics?.topPerformingClasses || []).slice(0, 5).map((cls, idx) => ({
    rank: idx + 1,
    name: cls.grade || `Grade ${idx + 1}`,
    score: cls.avg || 0,
    status: cls.label || 'Stable'
  }));

  // Recent activity
  const recentActivities = [
    ...(metrics?.recentActivity?.admissions || []).slice(0, 3).map(item => ({
      type: 'admission',
      description: `${item.firstName} ${item.lastName} enrolled`,
      timestamp: new Date(item.createdAt).toLocaleDateString(),
      icon: Users
    })),
    ...(metrics?.recentActivity?.assessments || []).slice(0, 2).map(item => ({
      type: 'assessment',
      description: `${item.title} recorded for ${item.learner?.firstName} ${item.learner?.lastName}`,
      timestamp: new Date(item.createdAt).toLocaleDateString(),
      icon: Activity
    }))
  ].slice(0, 5);

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

  if (refreshing && !metrics && !hasInstantData) {
    return <div className="animate-pulse space-y-6"><div className="h-96 bg-gray-200 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">
            Syncing dashboard metrics...
          </p>
        </div>
      )}

      {/* Hero Section */}
      <DashboardHero
        variant="default"
        title="School Executive Dashboard"
        subtitle="Real-time school health and performance metrics"
        stats={[
          { label: 'Health Score', value: `${healthScore}%` },
          { label: 'Active Students', value: stats.totalStudents.toLocaleString() },
          { label: 'Collection Rate', value: `${collectionRate}%` }
        ]}
      />

      {/* School Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AppCard 
          variant="elevated"
          title="School Health Score"
          subtitle="Overall institutional wellness"
          className="lg:col-span-1"
        >
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="text-6xl font-bold text-brand-purple">{healthScore}</div>
              <div className="text-sm text-gray-500 uppercase tracking-widest mt-2">Out of 100</div>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-gray-600">Attendance</span>
                  <span className="text-gray-900">{attendanceRate}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-teal" 
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-gray-600">Fee Collection</span>
                  <span className="text-gray-900">{collectionRate}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500" 
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-gray-600">Assessment Progress</span>
                  <span className="text-gray-900">{assessmentRate}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-purple" 
                    style={{ width: `${assessmentRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        {/* KPIs Section */}
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader 
            variant="default"
            title="Key Performance Indicators"
            level="h3"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <KpiCard 
              variant="primary"
              label="Revenue"
              value={`KES ${Math.round(stats.feeCollected / 1000)}k`}
              subvalue="Collected this term"
              icon={<DollarSign size={20} />}
              onClick={() => onNavigate('fees-collection')}
            />
            
            <KpiCard 
              variant="success"
              label="Attendance"
              value={`${attendanceRate}%`}
              subvalue={`${stats.presentToday} present today`}
              icon={<Calendar size={20} />}
              onClick={() => onNavigate('attendance-daily')}
            />
            
            <KpiCard 
              variant="neutral"
              label="Total Learners"
              value={stats.totalStudents.toLocaleString()}
              subvalue={`${stats.activeStudents} active`}
              icon={<Users size={20} />}
              onClick={() => onNavigate('learners-list')}
            />
            
            <KpiCard 
              variant="warning"
              label="Teaching Staff"
              value={stats.totalTeachers}
              subvalue={`${stats.activeTeachers} active`}
              icon={<Activity size={20} />}
              onClick={() => onNavigate('teachers-list')}
            />
          </div>
        </div>
      </div>

      {/* Attention Required */}
      {attentionItems.length > 0 && (
        <AppCard 
          variant="flat"
          title="Attention Required"
          subtitle="Items needing immediate action"
        >
          <div className="space-y-3">
            {attentionItems.map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
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
                      {item.title}
                    </h4>
                    <p className={`text-xs mt-1 ${
                      item.severity === 'high' ? 'text-rose-700' : 'text-amber-700'
                    }`}>
                      {item.description}
                    </p>
                  </div>
                  <div className={`text-lg font-bold ${
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

      {/* School Pulse & Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="School Pulse"
          subtitle="Real-time activity metrics"
        >
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-blue-900">Students Present</span>
                <span className="text-2xl font-bold text-blue-600">{stats.presentToday}</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">of {stats.totalStudents} enrolled</p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-emerald-900">Classes Assessed</span>
                <span className="text-2xl font-bold text-emerald-600">{stats.totalAssessedClasses}</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">Active assessment cycle</p>
            </div>

            <div className="p-4 bg-brand-purple/5 rounded-lg border border-brand-purple/20">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-brand-purple">Fee Collections</span>
                <span className="text-2xl font-bold text-brand-purple">{collectionRate}%</span>
              </div>
              <p className="text-xs text-brand-purple/70 mt-1">KES {Math.round(stats.feePending / 1000)}k outstanding</p>
            </div>
          </div>
        </AppCard>

        <AppCard 
          title="Revenue Trend"
          subtitle="Monthly fee collection pattern"
        >
          <div className="h-64">
            {revenueTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => `KES ${Math.round(value / 1000)}k`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<TrendingUp size={48} />} title="No data" description="Revenue trend data pending" />
            )}
          </div>
        </AppCard>
      </div>

      {/* AI Insights Placeholder */}
      <AppCard 
        variant="elevated"
        title="AI Insights Placeholder"
        subtitle="Smart analytics and recommendations coming soon"
      >
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-purple/10 rounded-full mb-4">
            <Brain size={32} className="text-brand-purple" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Zawadi AI Engine</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Predictive analytics and personalized recommendations will appear here once configured. 
            Currently analyzing student performance patterns.
          </p>
          <button
            onClick={() => onNavigate('settings-academic')}
            className="mt-6 px-6 py-2 bg-brand-purple text-white rounded-lg font-semibold text-sm hover:bg-brand-purple/90 transition"
          >
            Configure AI Features
          </button>
        </div>
      </AppCard>

      {/* Top Classes */}
      {topClasses.length > 0 && (
        <AppCard title="Top Performing Classes" subtitle="Academic performance rankings">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 uppercase text-xs">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 uppercase text-xs">Class</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600 uppercase text-xs">Score</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 uppercase text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {topClasses.map((cls) => (
                  <tr key={cls.rank} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">#{cls.rank}</td>
                    <td className="py-3 px-4 text-gray-900">{cls.name}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">{cls.score.toFixed(1)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-3 py-1 bg-brand-teal/10 text-brand-teal rounded-full text-xs font-semibold">
                        {cls.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <AppCard title="Recent Activity" subtitle="Latest actions and updates">
          <div className="space-y-1">
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-50 rounded-lg transition flex items-start gap-4">
                <div className="p-2 rounded-lg bg-gray-100">
                  <activity.icon size={16} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </AppCard>
      )}

      {/* Intelligence Engine Section */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <SectionHeader 
          title="Intelligence Engine" 
          level="h2"
          subtitle="AI-powered insights and analytics"
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* AI Insights */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <AIInsights contextType="school" contextId="default" />
          </Suspense>

          {/* Risk Alerts */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <RiskAlerts contextType="school" contextId="default" />
          </Suspense>

          {/* Fee Collection Forecast */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <FeeCollectionForecast contextType="school" contextId="default" />
          </Suspense>

          {/* Academic Insights */}
          <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
            <AcademicInsights contextType="school" contextId="default" />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
