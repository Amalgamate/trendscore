/**
 * Executive Admin Dashboard
 * High-level school health metrics and KPIs
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI, inventoryAPI, userAPI } from '../../../../services/api';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import {
  AppCard,
  EmptyState
} from '@/design-system/components';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, useDashboardSections } from './DashboardSections';
import AdminOverviewTabs from './AdminOverviewTabs';
import { useDashboardMetrics, formatKesAmount, formatPercent } from '../../hooks/useDashboardMetrics';
import OwnerAdvisorSection from '../../dashboard/widgets/admin/OwnerAdvisorSection';
import FinanceIntelligenceSection from '../../dashboard/widgets/admin/FinanceIntelligenceSection';
import FeeCollectionTrend from '../../dashboard/widgets/admin/FeeCollectionTrend';

import {
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  Activity,
  CheckCircle2,
  GraduationCap,
  Cog,
  BarChart3,
  Clock,
  Briefcase,
  Package,
  Shield
} from 'lucide-react';

import StaffPopup from '../../dashboard/widgets/StaffPopup';

const ADMIN_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM', 'RECEPTIONIST', 'ACCOUNTANT',
];

const SUBORDINATE_ROLES_LIST = [
  'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER',
  'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT',
];

const REPORT_COLORS = ['#0f766e', '#e11d48', '#4f46e5', '#f59e0b', '#16a34a'];

const compactValue = (value) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : value;
};

const ReportingWidgets = ({ config }) => {
  if (!config) return null;

  const pieData = (config.pieData || []).filter(item => Number(item.value || 0) > 0);
  const total = pieData.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,0.85fr)_minmax(420px,1.15fr)] gap-4">
      <AppCard className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{config.pieTitle}</p>
            <p className="mt-1 text-xs font-medium text-gray-400">{config.pieSubtitle}</p>
          </div>
          <BarChart3 size={18} className="text-gray-300" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] items-center gap-3 px-5 py-4">
          <div className="relative h-[180px] min-w-0">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color || REPORT_COLORS[index % REPORT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => compactValue(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold text-gray-900">{compactValue(total)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">total</span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs font-medium text-gray-400">No chart data</div>
            )}
          </div>
          <div className="space-y-2">
            {pieData.map((item, index) => {
              const percent = total > 0 ? Math.round((Number(item.value || 0) / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color || REPORT_COLORS[index % REPORT_COLORS.length] }} />
                    <span className="truncate text-xs font-semibold text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{compactValue(item.value)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{percent}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AppCard>

      <AppCard className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{config.summaryTitle}</p>
            <p className="mt-1 text-xs font-medium text-gray-400">{config.summarySubtitle}</p>
          </div>
          <Activity size={18} className="text-gray-300" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 py-4">
          {(config.summaryItems || []).map((item, index) => {
            const Icon = item.icon || Activity;
            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                onClick={item.onClick}
                className="group min-h-[82px] rounded-md border border-gray-100 bg-gray-50/60 px-4 py-3 text-left transition hover:border-gray-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-gray-500">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{item.value}</p>
                    <p className="mt-1 truncate text-xs font-medium text-gray-500">{item.note}</p>
                  </div>
                  <span className="rounded-md bg-white p-2 text-gray-400 ring-1 ring-gray-100 group-hover:text-gray-700">
                    <Icon size={16} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </AppCard>
    </div>
  );
};

const AdminDashboard = ({ learners = [], pagination, teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [activeOverviewTab, setActiveOverviewTab] = useState('general');
  const [subordinateCount, setSubordinateCount] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [subordinateUsers, setSubordinateUsers] = useState([]);
  const [inventoryReport, setInventoryReport] = useState({
    loaded: false,
    items: [],
    assets: [],
    movements: [],
  });
  const [adminPopup, setAdminPopup] = useState({ open: false, statusFilter: 'all', title: 'Administration Staff' });
  const [subordinatePopup, setSubordinatePopup] = useState({ open: false, statusFilter: 'all', title: 'Subordinate Staff' });
  // Tutors attendance popup: { open, statusFilter, title }
  const [tutorsPopup, setTutorsPopup] = useState({ open: false, statusFilter: 'ABSENT', title: 'Absent Tutors Today' });
  const canMarkTutorAttendance = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(String(user?.role || '').toUpperCase());

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
  
  const loadMetrics = async (filter = 'term', options = {}) => {
    try {
      setRefreshing(true);
      setApiError(null);
      const response = await dashboardAPI.getAdminMetrics(filter, options);
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

  // Load all admin + subordinate staff in one call
  useEffect(() => {
    userAPI.getAll()
      .then((res) => {
        const allUsers = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const admins = allUsers.filter(u => ADMIN_ROLES.includes(u.role));
        const subordinates = allUsers.filter(u => SUBORDINATE_ROLES_LIST.includes(u.role));
        setAdminUsers(admins);
        setSubordinateUsers(subordinates);
        // keep subordinateCount for legacy metrics fallback
        setSubordinateCount(subordinates.length || admins.length);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      inventoryAPI.getItems(),
      inventoryAPI.getAssetRegister(),
      inventoryAPI.getMovements(),
    ]).then(([itemsResult, assetsResult, movementsResult]) => {
      if (cancelled) return;

      const unwrap = (result) => {
        if (result.status !== 'fulfilled') return [];
        const value = result.value;
        if (Array.isArray(value)) return value;
        return Array.isArray(value?.data) ? value.data : [];
      };

      setInventoryReport({
        loaded: true,
        items: unwrap(itemsResult),
        assets: unwrap(assetsResult),
        movements: unwrap(movementsResult),
      });
    });

    return () => {
      cancelled = true;
    };
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
    avgAttendance: metrics?.stats?.avgAttendance || 0,
  };

  // Use shared metrics hook to calculate rates
  const { 
    attendanceRate, 
    collectionRate, 
    assessmentRate, 
    teacherActiveRate
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

  const assessmentBreakdown = Array.isArray(metrics?.unAssessedBreakdown) ? metrics.unAssessedBreakdown : [];
  const assessmentPopulation = assessmentBreakdown.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const assessedStudents = assessmentBreakdown.reduce((sum, row) => sum + Number(row.assessed || 0), 0);
  const unassessedStudents = assessmentBreakdown.reduce((sum, row) => sum + Number(row.unAssessed || 0), 0);
  const currentAssessmentRate = assessmentPopulation > 0
    ? Math.round((assessedStudents / assessmentPopulation) * 100)
    : assessmentRate;
  const inactiveTeachers = Math.max(0, stats.totalTeachers - stats.activeTeachers);
  const inactiveAdminUsers = adminUsers.filter(u => u.status === 'INACTIVE' || u.archived === true).length;
  const activeAdminUsers = Math.max(0, adminUsers.length - inactiveAdminUsers);
  const inactiveSubordinateUsers = subordinateUsers.filter(u => u.status === 'INACTIVE' || u.archived === true).length;
  const activeSubordinateUsers = Math.max(0, subordinateUsers.length - inactiveSubordinateUsers);
  const stableLearners = Math.max(0, stats.totalStudents - stats.atRiskStudents);
  const upcomingEvents = Array.isArray(metrics?.upcomingEvents) ? metrics.upcomingEvents : [];
  const eventCategoryMap = upcomingEvents.reduce((acc, event) => {
    const category = String(event.category || 'OTHER').replace(/_/g, ' ');
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const calendarPieData = Object.entries(eventCategoryMap).map(([name, value], index) => ({
    name,
    value,
    color: REPORT_COLORS[index % REPORT_COLORS.length],
  }));
  const nextEvent = [...upcomingEvents]
    .filter(event => event.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const inventoryItems = inventoryReport.items;
  const inventoryAssets = inventoryReport.assets;
  const inventoryMovements = inventoryReport.movements;
  const consumableCount = inventoryItems.filter(item => String(item.type || '').toUpperCase() === 'CONSUMABLE').length;
  const nonConsumableCount = Math.max(0, inventoryItems.length - consumableCount);
  const lowStockCount = inventoryItems.filter(item => (
    Number(item.quantity || 0) <= Number(item.minimumStock ?? item.reorderLevel ?? 5)
  )).length;
  const inventoryValue = inventoryItems.reduce((sum, item) => (
    sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0))
  ), 0);

  const reportingConfigByTab = {
    financials: {
      pieTitle: 'Collection Mix',
      pieSubtitle: 'Collected against outstanding balance',
      pieData: [
        { name: 'Collected', value: stats.feeCollected, color: '#16a34a' },
        { name: 'Outstanding', value: stats.feePending, color: '#e11d48' },
      ],
      summaryTitle: 'Finance Signals',
      summarySubtitle: 'Cash position and follow-up pressure',
      summaryItems: [
        { label: 'Collection Rate', value: formatPercent(collectionRate), note: 'Against expected fee position', icon: Activity, onClick: () => onNavigate('fees-collection') },
        { label: 'Outstanding', value: formatKesAmount(stats.feePending), note: 'Requires parent follow-up', icon: AlertTriangle, onClick: () => onNavigate('fees-collection') },
        { label: 'Collected', value: formatKesAmount(stats.feeCollected), note: 'Recorded fee collections', icon: DollarSign, onClick: () => onNavigate('fees-collection') },
        { label: 'Trend Points', value: revenueTrendData.length || 0, note: 'Revenue trend records loaded', icon: TrendingUp },
      ],
    },
    academic: {
      pieTitle: 'Assessment Coverage',
      pieSubtitle: metrics?.stats?.currentTestSeries || 'Current assessment series',
      pieData: [
        { name: 'Assessed', value: assessedStudents, color: '#0f766e' },
        { name: 'Unassessed', value: unassessedStudents, color: '#e11d48' },
      ],
      summaryTitle: 'Academic Report',
      summarySubtitle: 'Class performance and completion status',
      summaryItems: [
        { label: 'Assessment Progress', value: assessmentPopulation > 0 ? formatPercent(currentAssessmentRate) : 'No data', note: `${unassessedStudents} learners still pending`, icon: GraduationCap, onClick: () => onNavigate('assess-summary-report') },
        { label: 'Top Class', value: topClasses[0]?.name || 'N/A', note: `Score ${topClasses[0]?.score?.toFixed?.(1) || '0'}`, icon: TrendingUp },
        { label: 'Assessed Classes', value: stats.totalAssessedClasses || 0, note: 'Classes with recorded data', icon: BarChart3 },
        { label: 'At Risk', value: stats.atRiskStudents || 0, note: 'Learners needing support', icon: AlertTriangle, onClick: () => onNavigate('learners-list') },
      ],
    },
    operations: {
      pieTitle: 'Daily Attendance Split',
      pieSubtitle: 'Present and absent learners today',
      pieData: [
        { name: 'Present', value: stats.presentToday, color: '#0f766e' },
        { name: 'Absent', value: stats.absentToday, color: '#e11d48' },
      ],
      summaryTitle: 'Operations Report',
      summarySubtitle: 'Attendance and staffing coverage',
      summaryItems: [
        { label: 'Attendance Rate', value: formatPercent(attendanceRate), note: `${stats.presentToday} present today`, icon: Users, onClick: () => onNavigate('attendance-reports') },
        { label: 'Absent Today', value: stats.absentToday || 0, note: 'Needs follow-up', icon: AlertTriangle, onClick: () => onNavigate('attendance-reports') },
        { label: 'Staff Coverage', value: formatPercent(operationsRate), note: `${stats.activeTeachers}/${stats.totalTeachers} active`, icon: CheckCircle2 },
        { label: 'Term Attendance', value: formatPercent(stats.avgAttendance), note: 'Average recorded attendance', icon: Activity },
      ],
    },
    calendar: {
      pieTitle: 'Upcoming Event Mix',
      pieSubtitle: `${upcomingEvents.length} scheduled events`,
      pieData: calendarPieData,
      summaryTitle: 'Planning Report',
      summarySubtitle: 'Live calendar and activity snapshot',
      summaryItems: [
        { label: 'Scheduled Events', value: upcomingEvents.length, note: 'Upcoming calendar entries', icon: Calendar, onClick: () => onNavigate('planner-calendar') },
        { label: 'Next Event', value: nextEvent?.title || 'None', note: nextEvent?.date ? new Date(nextEvent.date).toLocaleDateString() : 'No upcoming event recorded', icon: Clock, onClick: () => onNavigate('planner-calendar') },
        { label: 'Event Categories', value: calendarPieData.length, note: 'Types represented in calendar', icon: Activity },
        { label: 'Recent Updates', value: recentActivities.length || 0, note: 'Admissions and assessment updates', icon: TrendingUp },
      ],
    },
    insights: {
      pieTitle: 'Learner Risk Profile',
      pieSubtitle: 'Risk signals against stable learners',
      pieData: [
        { name: 'Stable', value: stableLearners, color: '#0f766e' },
        { name: 'At Risk', value: stats.atRiskStudents, color: '#e11d48' },
      ],
      summaryTitle: 'AI Insight Report',
      summarySubtitle: 'Signals that need admin attention',
      summaryItems: [
        { label: 'At-Risk Learners', value: stats.atRiskStudents || 0, note: 'Require support', icon: AlertTriangle, onClick: () => onNavigate('learners-list') },
        { label: 'Attention Areas', value: attentionItems.length, note: 'Active warnings', icon: Cog },
        { label: 'Recent Activity', value: recentActivities.length || 0, note: 'Latest updates', icon: Activity },
        { label: 'Stable Learners', value: stableLearners, note: 'No active risk signal', icon: CheckCircle2 },
      ],
    },
    hr: {
      pieTitle: 'Staff Status Profile',
      pieSubtitle: 'Active and inactive staff records',
      pieData: [
        { name: 'Active Tutors', value: stats.activeTeachers, color: '#0f766e' },
        { name: 'Inactive Tutors', value: inactiveTeachers, color: '#e11d48' },
        { name: 'Active Admin', value: activeAdminUsers, color: '#4f46e5' },
        { name: 'Active Support', value: activeSubordinateUsers, color: '#f59e0b' },
      ],
      summaryTitle: 'HR Report',
      summarySubtitle: 'Staff coverage across teams',
      summaryItems: [
        { label: 'Total Tutors', value: stats.totalTeachers || 0, note: `${stats.activeTeachers} active`, icon: GraduationCap, onClick: () => onNavigate('teachers-list') },
        { label: 'Administration', value: adminUsers.length, note: `${activeAdminUsers} active`, icon: Shield, onClick: () => setAdminPopup({ open: true, statusFilter: 'all', title: 'Administration Staff' }) },
        { label: 'Support Staff', value: subordinateUsers.length, note: `${activeSubordinateUsers} active`, icon: Users, onClick: () => setSubordinatePopup({ open: true, statusFilter: 'all', title: 'Subordinate Staff' }) },
        { label: 'Inactive Records', value: inactiveTeachers + inactiveAdminUsers + inactiveSubordinateUsers, note: 'Staff records needing review', icon: AlertTriangle },
      ],
    },
    inventory: {
      pieTitle: 'Inventory Item Mix',
      pieSubtitle: inventoryReport.loaded ? `${inventoryItems.length} registered stock items` : 'Loading inventory records',
      pieData: [
        { name: 'Consumables', value: consumableCount, color: '#4f46e5' },
        { name: 'Other Items', value: nonConsumableCount, color: '#0f766e' },
      ],
      summaryTitle: 'Inventory Report',
      summarySubtitle: 'Stock control and accountability',
      summaryItems: [
        { label: 'Stock Items', value: inventoryReport.loaded ? inventoryItems.length : '...', note: 'Registered inventory lines', icon: Package, onClick: () => onNavigate('inventory-items') },
        { label: 'Asset Register', value: inventoryReport.loaded ? inventoryAssets.length : '...', note: 'Tracked fixed assets', icon: Briefcase, onClick: () => onNavigate('inventory-assets') },
        { label: 'Stock Value', value: inventoryReport.loaded ? formatKesAmount(inventoryValue) : '...', note: `${inventoryMovements.length} recorded movements`, icon: Activity, onClick: () => onNavigate('inventory-movements') },
        { label: 'Low Stock', value: inventoryReport.loaded ? lowStockCount : '...', note: 'Items at or below reorder level', icon: AlertTriangle, onClick: () => onNavigate('inventory-items') },
      ],
    },
  };

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
                  { value: metrics?.stats?.presentTeachers ?? stats.activeTeachers, label: 'Present',  dot: '#86efac', onClick: () => setTutorsPopup({ open: true, statusFilter: 'PRESENT', title: 'Present Tutors Today' }) },
                  { value: metrics?.stats?.absentTeachers  ?? 0,                    label: 'Absent',   dot: '#fca5a5', onClick: () => setTutorsPopup({ open: true, statusFilter: 'ABSENT',  title: 'Absent Tutors Today' }) },
                  { value: metrics?.stats?.staffOnLeave    ?? 0,                    label: 'On Leave', dot: '#fde047', onClick: () => setTutorsPopup({ open: true, statusFilter: 'ON_LEAVE', title: 'Tutors On Leave Today' }) },
                ],
                icon: <GraduationCap size={26} />,
                tone: 'teal',
                onClick: () => onNavigate('teachers-list'),
              },
              {
                label: 'Subordinate Staff',
                value: subordinateUsers.length || metrics?.stats?.totalSubordinateStaff || subordinateCount,
                subvalue: 'Support & operations roles',
                chips: [
                  {
                    value: subordinateUsers.filter(u => u.status !== 'INACTIVE' && u.archived !== true).length || metrics?.stats?.presentSubordinateStaff || 0,
                    label: 'Active',
                    dot: '#86efac',
                    onClick: () => setSubordinatePopup({ open: true, statusFilter: 'active', title: 'Active Subordinate Staff' }),
                  },
                  {
                    value: subordinateUsers.filter(u => u.status === 'INACTIVE' || u.archived === true).length || metrics?.stats?.absentSubordinateStaff || 0,
                    label: 'Inactive',
                    dot: '#fca5a5',
                    onClick: () => setSubordinatePopup({ open: true, statusFilter: 'inactive', title: 'Inactive Subordinate Staff' }),
                  },
                ],
                icon: <Users size={26} />,
                tone: 'red',
                onClick: () => setSubordinatePopup({ open: true, statusFilter: 'all', title: 'Subordinate Staff' }),
              },
              {
                label: 'Administration',
                value: adminUsers.length,
                subvalue: 'Admin & leadership staff',
                chips: [
                  {
                    value: adminUsers.filter(u => u.status !== 'INACTIVE' && u.archived !== true).length,
                    label: 'Active',
                    dot: '#86efac',
                    onClick: () => setAdminPopup({ open: true, statusFilter: 'active', title: 'Active Administration Staff' }),
                  },
                  {
                    value: adminUsers.filter(u => u.status === 'INACTIVE' || u.archived === true).length,
                    label: 'Inactive',
                    dot: '#fca5a5',
                    onClick: () => setAdminPopup({ open: true, statusFilter: 'inactive', title: 'Inactive Administration Staff' }),
                  },
                ],
                icon: <Shield size={26} />,
                tone: 'green',
                onClick: () => setAdminPopup({ open: true, statusFilter: 'all', title: 'Administration Staff' }),
              },
            ]}
          />
        )}

        {/* ── Finance chart + compact Personal Advisor — shown only on General Overview tab ── */}
        {activeOverviewTab === 'general' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[35fr_65fr]">
            <DashboardSection id="finance-intelligence" controls={sectionControls}>
              <FinanceIntelligenceSection
                collected={metrics?.stats?.feeCollected ?? 0}
                outstanding={metrics?.stats?.feePending ?? 0}
                waived={metrics?.stats?.feeWaived ?? 0}
                loading={refreshing && !metrics}
                onNavigate={onNavigate}
              />
            </DashboardSection>

            <DashboardSection id="owner-advisor" controls={sectionControls}>
              <OwnerAdvisorSection onNavigate={onNavigate} variant="minimal" />
            </DashboardSection>
          </div>
        )}

        {/* Financials */}
        {activeOverviewTab === 'financials' && (
          <div className="space-y-4">
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

            <FeeCollectionTrend
              loading={refreshing && !metrics}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* Academic Performance */}
        {activeOverviewTab === 'academic' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AppCard className="!bg-blue-950 !border-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Assessment Progress</p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatPercent(currentAssessmentRate)}</p>
                  <p className="mt-1 text-xs text-white/70">{unassessedStudents} unassessed</p>
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
                  <p className="mt-2 text-2xl font-bold text-white">{upcomingEvents.length}</p>
                  <p className="mt-1 text-xs text-white/70">Upcoming scheduled events</p>
                </div>
                <Calendar size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-teal-700 !border-teal-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Next Event</p>
                  <p className="mt-2 truncate text-2xl font-bold text-white">{nextEvent?.title || 'None'}</p>
                  <p className="mt-1 text-xs text-white/70">{nextEvent?.date ? new Date(nextEvent.date).toLocaleDateString() : 'No event scheduled'}</p>
                </div>
                <Clock size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Event Categories</p>
                  <p className="mt-2 text-2xl font-bold text-white">{calendarPieData.length}</p>
                  <p className="mt-1 text-xs text-white/70">Types represented</p>
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
                  <p className="mt-2 text-2xl font-bold text-white">{inventoryReport.loaded ? inventoryItems.length : '...'}</p>
                  <p className="mt-1 text-xs text-white/70">Registered inventory lines</p>
                </div>
                <Package size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-green-700 !border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Low Stock</p>
                  <p className="mt-2 text-2xl font-bold text-white">{inventoryReport.loaded ? lowStockCount : '...'}</p>
                  <p className="mt-1 text-xs text-white/70">At or below reorder level</p>
                </div>
                <TrendingUp size={32} className="text-white/20" />
              </div>
            </AppCard>

            <AppCard className="!bg-blue-950 !border-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Assets</p>
                  <p className="mt-2 text-2xl font-bold text-white">{inventoryReport.loaded ? inventoryAssets.length : '...'}</p>
                  <p className="mt-1 text-xs text-white/70">Registered fixed assets</p>
                </div>
                <Briefcase size={32} className="text-white/20" />
              </div>
            </AppCard>
          </div>
        )}

        <ReportingWidgets config={reportingConfigByTab[activeOverviewTab]} />
      </div>

      {/* ── Tutors attendance popup ── */}
      <StaffPopup
        open={tutorsPopup.open}
        onClose={() => setTutorsPopup(p => ({ ...p, open: false }))}
        mode="attendance"
        title={tutorsPopup.title}
        headerColor="bg-red-50"
        headerIcon={<Users size={14} className="text-red-500" />}
        statusFilter={tutorsPopup.statusFilter}
        canMarkAttendance={canMarkTutorAttendance}
        onAttendanceChanged={() => loadMetrics('term', { fresh: true })}
      />

      {/* ── Administration staff popup ── */}
      <StaffPopup
        open={adminPopup.open}
        onClose={() => setAdminPopup(p => ({ ...p, open: false }))}
        mode="grouped"
        title={adminPopup.title}
        headerColor="bg-purple-50"
        headerIcon={<Shield size={14} className="text-purple-500" />}
        users={adminUsers}
        roleOrder={ADMIN_ROLES}
        initialStatusFilter={adminPopup.statusFilter}
      />

      {/* ── Subordinate staff popup ── */}
      <StaffPopup
        open={subordinatePopup.open}
        onClose={() => setSubordinatePopup(p => ({ ...p, open: false }))}
        mode="grouped"
        title={subordinatePopup.title}
        headerColor="bg-red-50"
        headerIcon={<Users size={14} className="text-red-500" />}
        users={subordinateUsers}
        roleOrder={SUBORDINATE_ROLES_LIST}
        initialStatusFilter={subordinatePopup.statusFilter}
      />
    </>
  );
};

export default AdminDashboard;
