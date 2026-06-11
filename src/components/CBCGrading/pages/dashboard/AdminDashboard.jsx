/**
 * Executive Admin Dashboard
 * High-level school health metrics and KPIs
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI, accountingAPI, userAPI } from '../../../../services/api';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts';
import {
  AppCard,
  SectionHeader,
  EmptyState
} from '@/design-system/components';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import AdminOverviewTabs from './AdminOverviewTabs';
import { useDashboardMetrics, formatKesAmount, formatPercent } from '../../hooks/useDashboardMetrics';
import OwnerAdvisorSection from '../../dashboard/widgets/admin/OwnerAdvisorSection';
import FinanceIntelligenceSection from '../../dashboard/widgets/admin/FinanceIntelligenceSection';

import {
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  Activity,
  ChevronDown,
  CheckCircle2,
  GraduationCap,
  Cog,
  BarChart3,
  Clock,
  Briefcase,
  Package
} from 'lucide-react';

import BillingInsightsCard from '../../dashboard/BillingInsightsCard';

const SUBORDINATE_ROLES = [
  'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE',
  'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'
];

const AdminDashboard = ({ learners = [], pagination, teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [activeOverviewTab, setActiveOverviewTab] = useState('general');
  const [subordinateCount, setSubordinateCount] = useState(0);
  const [vendorCount, setVendorCount] = useState(0);
  const [activeVendorCount, setActiveVendorCount] = useState(0);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('admin', [
    { id: 'executive-summary',   label: 'Executive Summary',   description: 'Students, staff, collection, health' },
    { id: 'owner-advisor',       label: 'Personal Advisor',    description: 'Recommended actions from the advisor' },
    { id: 'finance-intelligence',label: 'Finance Intelligence', description: 'Revenue performance and collection trends' },
    { id: 'attention-required',  label: 'Attention Required',  description: 'Items requiring intervention' },
    { id: 'pulse-revenue',       label: 'Activity & Revenue',  description: 'Recent activity and revenue trend' },
    { id: 'top-classes',         label: 'Top Performing Classes', description: 'Academic rankings' },
  ]);
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

  // Load subordinate staff count and vendor count in parallel
  useEffect(() => {
    // Subordinate staff — use userAPI stats if available, otherwise fetch all users
    userAPI.getStats()
      .then((res) => {
        const data = res?.data ?? res;
        // Sum up all subordinate role counts if the stats endpoint returns per-role breakdown
        if (data?.byRole) {
          const count = SUBORDINATE_ROLES.reduce((acc, role) => acc + (data.byRole[role] ?? 0), 0);
          setSubordinateCount(count);
        } else if (typeof data?.subordinateStaff === 'number') {
          setSubordinateCount(data.subordinateStaff);
        }
      })
      .catch(() => {});

    // Vendors / suppliers
    accountingAPI.getVendors()
      .then((res) => {
        const vendors = Array.isArray(res?.data) ? res.data : [];
        setVendorCount(vendors.length);
        setActiveVendorCount(vendors.filter(v => v.isActive !== false && v.status !== 'INACTIVE').length);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Use shared metrics hook to calculate rates
  const { 
    attendanceRate, 
    collectionRate, 
    assessmentRate, 
    teacherActiveRate, 
    healthScore 
  } = useDashboardMetrics(stats);
  
  const operationsRate = teacherActiveRate;

  // Revenue trend data
  const revenueTrendData = metrics?.financials?.trendData || [];

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
    <>
      <AdminOverviewTabs
        activeTab={activeOverviewTab}
        onTabChange={setActiveOverviewTab}
        onNavigate={onNavigate}
        stats={stats}
        metrics={metrics}
        formatKesAmount={formatKesAmount}
        formatPercent={formatPercent}
        sectionControls={sectionControls}
      />

      <div className="px-[var(--app-gutter-x)] pt-6 space-y-6">
        {/* General Overview */}
        {activeOverviewTab === 'general' && (
          <DashboardSummary
            title="Executive Summary"
            description="The institution-wide position that needs the admin's first glance."
            showHeader={false}
            items={[
              {
                label: 'Students',
                value: stats.totalStudents.toLocaleString(),
                subvalue: stats.presentToday > 0
                  ? `${stats.presentToday} present · ${stats.absentToday ?? 0} absent today`
                  : `${stats.activeStudents.toLocaleString()} active`,
                chips: [
                  { value: metrics?.stats?.males   ?? 0, label: 'Male',   dot: '#38bdf8' },
                  { value: metrics?.stats?.females ?? 0, label: 'Female', dot: '#f9a8d4' },
                ],
                icon: <Users size={26} />,
                tone: 'navy',
                onClick: () => onNavigate('learners-list'),
              },
              {
                label: 'Tutors',
                value: stats.totalTeachers,
                subvalue: metrics?.stats?.teacherAttendanceRate != null
                  ? `${metrics.stats.teacherAttendanceRate}% present today`
                  : `${stats.activeTeachers} active`,
                chips: [
                  { value: metrics?.stats?.presentTeachers ?? stats.activeTeachers, label: 'Present',  dot: '#86efac' },
                  { value: metrics?.stats?.absentTeachers  ?? 0,                    label: 'Absent',   dot: '#fca5a5' },
                  { value: metrics?.stats?.staffOnLeave    ?? 0,                    label: 'On Leave', dot: '#fde047' },
                ],
                icon: <GraduationCap size={26} />,
                tone: 'teal',
                onClick: () => onNavigate('teachers-list'),
              },
              {
                label: 'Subordinate Staff',
                value: metrics?.stats?.totalSubordinateStaff ?? subordinateCount,
                subvalue: metrics?.stats?.staffAttendanceRate != null
                  ? `${metrics.stats.staffAttendanceRate}% present today`
                  : 'Support roles',
                chips: [
                  { value: metrics?.stats?.presentSubordinateStaff ?? 0,                                           label: 'Present', dot: '#86efac' },
                  { value: metrics?.stats?.absentSubordinateStaff  ?? (metrics?.stats?.totalSubordinateStaff ?? subordinateCount), label: 'Absent',  dot: '#fca5a5' },
                ],
                icon: <Users size={26} />,
                tone: 'red',
                onClick: () => onNavigate('settings-users'),
              },
              {
                label: 'Suppliers',
                value: vendorCount,
                subvalue: 'Registered vendors',
                chips: [
                  { value: activeVendorCount,               label: 'Active',   dot: '#86efac' },
                  { value: vendorCount - activeVendorCount, label: 'Inactive', dot: '#fca5a5' },
                ],
                icon: <DollarSign size={26} />,
                tone: 'green',
                onClick: () => onNavigate('accounting-vendors'),
              },
            ]}
          />
        )}

        {/* ── Personal Advisor — shown only on General Overview tab ── */}
        {activeOverviewTab === 'general' && (
          <DashboardSection id="owner-advisor" controls={sectionControls}>
            <OwnerAdvisorSection onNavigate={onNavigate} />
          </DashboardSection>
        )}

        {/* ── Finance Intelligence — shown only on General Overview tab ── */}
        {activeOverviewTab === 'general' && (
          <DashboardSection id="finance-intelligence" controls={sectionControls}>
            <FinanceIntelligenceSection
              collected={metrics?.stats?.feeCollected ?? 0}
              outstanding={metrics?.stats?.feePending ?? 0}
              waived={metrics?.stats?.feeWaived ?? 0}
              trendData={metrics?.financials?.trendData ?? undefined}
              loading={refreshing && !metrics}
              onNavigate={onNavigate}
            />
          </DashboardSection>
        )}

        {/* Financials */}
        {activeOverviewTab === 'financials' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Fee Collected</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatKesAmount(stats.feeCollected)}</p>
                </div>
                <DollarSign size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-rose-600 !border-rose-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Outstanding</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatKesAmount(stats.feePending)}</p>
                </div>
                <AlertTriangle size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Collection Rate</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatPercent(collectionRate)}</p>
                </div>
                <Activity size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        {/* Academic Performance */}
        {activeOverviewTab === 'academic' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-blue-950 !border-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Assessment Progress</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatPercent(assessmentRate)}</p>
                  <p className="mt-1 text-xs text-white/70">{stats.totalMissedExams} unassessed</p>
                </div>
                <GraduationCap size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Top Performing</p>
                  <p className="mt-2 text-2xl font-bold text-white">{topClasses[0]?.name || 'N/A'}</p>
                  <p className="mt-1 text-xs text-white/70">Score: {topClasses[0]?.score.toFixed(1) || '0'}</p>
                </div>
                <TrendingUp size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-rose-600 !border-rose-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Assessed Classes</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stats.totalAssessedClasses || 0}</p>
                  <p className="mt-1 text-xs text-white/70">With recorded data</p>
                </div>
                <BarChart3 size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        {/* School Operations */}
        {activeOverviewTab === 'operations' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Attendance Rate</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatPercent(attendanceRate)}</p>
                  <p className="mt-1 text-xs text-white/70">{stats.presentToday} present today</p>
                </div>
                <Users size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-rose-600 !border-rose-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Absent Today</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stats.absentToday || 0}</p>
                  <p className="mt-1 text-xs text-white/70">Needing follow-up</p>
                </div>
                <AlertTriangle size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Staff Coverage</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatPercent(operationsRate)}</p>
                  <p className="mt-1 text-xs text-white/70">{stats.activeTeachers}/{stats.totalTeachers} active</p>
                </div>
                <CheckCircle2 size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        {/* School Calendar */}
        {activeOverviewTab === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-blue-950 !border-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Calendar</p>
                  <p className="mt-2 text-2xl font-bold text-white">Planner</p>
                  <p className="mt-1 text-xs text-white/70">School events & dates</p>
                </div>
                <Calendar size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Timetable</p>
                  <p className="mt-2 text-2xl font-bold text-white">Active</p>
                  <p className="mt-1 text-xs text-white/70">Class & staff schedules</p>
                </div>
                <Clock size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Agenda</p>
                  <p className="mt-2 text-2xl font-bold text-white">Ready</p>
                  <p className="mt-1 text-xs text-white/70">Daily planning</p>
                </div>
                <Activity size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        {/* AI Smart Insights */}
        {activeOverviewTab === 'insights' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-rose-600 !border-rose-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">At-Risk Learners</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stats.atRiskStudents || 0}</p>
                  <p className="mt-1 text-xs text-white/70">Requiring support</p>
                </div>
                <AlertTriangle size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-rose-600 !border-rose-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Attention Areas</p>
                  <p className="mt-2 text-2xl font-bold text-white">{attentionItems.length}</p>
                  <p className="mt-1 text-xs text-white/70">Active warnings</p>
                </div>
                <Cog size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Recent Activity</p>
                  <p className="mt-2 text-2xl font-bold text-white">{recentActivities.length || 0}</p>
                  <p className="mt-1 text-xs text-white/70">Latest updates</p>
                </div>
                <Activity size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        {/* HR Overview */}
        {activeOverviewTab === 'hr' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-blue-950 !border-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Total Staff</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stats.totalTeachers || 0}</p>
                  <p className="mt-1 text-xs text-white/70">Staff records</p>
                </div>
                <Users size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Active Staff</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stats.activeTeachers || 0}</p>
                  <p className="mt-1 text-xs text-white/70">Currently active</p>
                </div>
                <CheckCircle2 size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Staff Coverage</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatPercent(teacherActiveRate)}</p>
                  <p className="mt-1 text-xs text-white/70">Active coverage rate</p>
                </div>
                <TrendingUp size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        {/* Inventory */}
        {activeOverviewTab === 'inventory' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-rose-600 !border-rose-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Stock Items</p>
                  <p className="mt-2 text-2xl font-bold text-white">Catalog</p>
                  <p className="mt-1 text-xs text-white/70">Manage school supplies</p>
                </div>
                <Package size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Stock Movements</p>
                  <p className="mt-2 text-2xl font-bold text-white">Tracked</p>
                  <p className="mt-1 text-xs text-white/70">Movement history</p>
                </div>
                <TrendingUp size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-blue-950 !border-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Assets</p>
                  <p className="mt-2 text-2xl font-bold text-white">Register</p>
                  <p className="mt-1 text-xs text-white/70">Assigned assets</p>
                </div>
                <Briefcase size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboard;
