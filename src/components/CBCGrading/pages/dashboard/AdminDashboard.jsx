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
  Brain,
  ChevronDown,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  BarChart3,
  Cog
} from 'lucide-react';

// Intelligence Engine Widgets
import AIInsights from '../../widgets/AIInsights';
import RiskAlerts from '../../widgets/RiskAlerts';
import FeeCollectionForecast from '../../widgets/FeeCollectionForecast';
import AcademicInsights from '../../widgets/AcademicInsights';
import BillingInsightsCard from '../../dashboard/BillingInsightsCard';

const AdminDashboard = ({ learners = [], pagination, teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const hasInstantData = learners.length > 0 || teachers.length > 0 || (pagination?.total || 0) > 0;
  
  const userName = user?.name || user?.firstName || user?.email?.split('@')[0] || 'Admin';
  const firstName = userName.split(' ')[0];
  const formatKesAmount = (amount = 0) => {
    const value = Number(amount) || 0;
    if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `KES ${Math.round(value / 1000)}K`;
    return `KES ${value.toLocaleString()}`;
  };
  const formatPercent = (value = 0) => `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

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
  const teacherActiveRate = stats.totalTeachers > 0
    ? Math.round((stats.activeTeachers / stats.totalTeachers) * 100)
    : 0;
  const inactiveTeachers = Math.max(0, (Number(stats.totalTeachers) || 0) - (Number(stats.activeTeachers) || 0));
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
    <div className="space-y-6">
      {refreshing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">
            Syncing dashboard metrics...
          </p>
        </div>
      )}

      {/* Dynamic Welcome Banner */}
      <div className="bg-brand-purple text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white mt-1 leading-tight tracking-tight">
            {getGreeting()}, <span>{firstName}</span>
          </h1>
          <p className="text-sm text-white/70 mt-1 font-medium max-w-xl">
            Welcome back to the Trends command center. Here is your institutional summary overview for today.
          </p>
        </div>
        
        {/* Real-time Summary Cards/Badges */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Health Badge */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 shadow-sm min-w-[110px] flex flex-col items-center text-center transition-all hover:shadow-md">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Health</span>
            <span className="text-xl font-black mt-1 text-white">{formatPercent(healthScore)}</span>
          </div>
          
          {/* Active Students Badge */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 shadow-sm min-w-[110px] flex flex-col items-center text-center transition-all hover:shadow-md">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Students</span>
            <span className="text-xl font-black text-white mt-1">{stats.totalStudents.toLocaleString()}</span>
          </div>
          
          {/* Collection Rate Badge */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 shadow-sm min-w-[110px] flex flex-col items-center text-center transition-all hover:shadow-md">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Collection</span>
            <span className="text-xl font-black text-white mt-1">{formatPercent(collectionRate)}</span>
          </div>
        </div>
      </div>

      {/* School Health & Executive Summary Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN — SCHOOL HEALTH */}
        <AppCard 
          variant="elevated"
          title="School Health"
          className="flex flex-col justify-between"
          headerAction={
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition shadow-sm">
              <Calendar size={13} className="text-gray-500" />
              <span>This Week</span>
              <ChevronDown size={12} className="text-gray-400" />
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              {/* LEFT SIDE — Large Circular Progress */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center border-r border-gray-100 sm:pr-4">
                <div className="relative flex items-center justify-center w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#f1f5f9"
                      strokeWidth="7"
                      fill="transparent"
                    />
                    {/* Foreground Circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#16A34A"
                      strokeWidth="7"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={(2 * Math.PI * 40) - (healthScore / 100) * (2 * Math.PI * 40)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  {/* Inner Text */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-extrabold text-gray-900 leading-none">{formatPercent(healthScore)}</span>
                    <span className="text-[10px] font-bold text-emerald-600 tracking-wider mt-1.5 uppercase">
                      {healthScore >= 80 ? 'GOOD' : healthScore >= 60 ? 'STABLE' : 'PENDING'}
                    </span>
                    <span className="text-[8px] text-gray-400 mt-1 font-medium">live metrics</span>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE — Four Health Dimensions */}
              <div className="sm:col-span-7 space-y-3.5">
                {/* Finance Health */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                        <DollarSign size={13} />
                      </div>
                      <span className="text-gray-700 font-semibold text-[13px]">Finance</span>
                    </div>
                    <span className="text-gray-950 font-bold text-[13px]">{formatPercent(collectionRate)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500" 
                      style={{ width: `${collectionRate}%` }}
                    />
                  </div>
                </div>

                {/* Attendance Health */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                        <Users size={13} />
                      </div>
                      <span className="text-gray-700 font-semibold text-[13px]">Attendance</span>
                    </div>
                    <span className="text-gray-950 font-bold text-[13px]">{formatPercent(attendanceRate)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                </div>

                {/* Academic Health */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-50 text-purple-600">
                        <GraduationCap size={13} />
                      </div>
                      <span className="text-gray-700 font-semibold text-[13px]">Academics</span>
                    </div>
                    <span className="text-gray-950 font-bold text-[13px]">{formatPercent(assessmentRate)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                      style={{ width: `${assessmentRate}%` }}
                    />
                  </div>
                </div>

                {/* Operations Health */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-orange-50 text-orange-600">
                        <Cog size={13} />
                      </div>
                      <span className="text-gray-700 font-semibold text-[13px]">Operations</span>
                    </div>
                    <span className="text-gray-950 font-bold text-[13px]">{formatPercent(operationsRate)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-600 rounded-full transition-all duration-500" 
                      style={{ width: `${operationsRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 my-4"></div>

            {/* Status Strip */}
            <div className="grid grid-cols-4 gap-2 text-center pt-2">
              {/* Money */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 mb-1 shadow-sm border border-emerald-100/50">
                  <DollarSign size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-900 mt-1">Money</span>
                <span className="text-[10px] font-bold text-emerald-600 mt-0.5">Healthy</span>
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center mt-2.5 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 size={12} className="fill-emerald-100 text-emerald-600" />
                </div>
              </div>

              {/* Learners */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 text-blue-600 mb-1 shadow-sm border border-blue-100/50">
                  <Users size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-900 mt-1">Learners</span>
                <span className="text-[10px] font-bold text-emerald-600 mt-0.5">Healthy</span>
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center mt-2.5 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 size={12} className="fill-emerald-100 text-emerald-600" />
                </div>
              </div>

              {/* Teachers */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-50 text-purple-600 mb-1 shadow-sm border border-purple-100/50">
                  <Users size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-900 mt-1">Teachers</span>
                <span className="text-[10px] font-bold text-emerald-600 mt-0.5">Healthy</span>
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center mt-2.5 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 size={12} className="fill-emerald-100 text-emerald-600" />
                </div>
              </div>

              {/* Academics */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-50 text-orange-600 mb-1 shadow-sm border border-orange-100/50">
                  <GraduationCap size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-900 mt-1">Academics</span>
                <span className="text-[10px] font-bold text-orange-600 mt-0.5">Attention</span>
                <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center mt-2.5 text-orange-600 border border-orange-200">
                  <AlertTriangle size={11} className="text-orange-600 fill-orange-100" />
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        {/* RIGHT COLUMN — EXECUTIVE SUMMARY */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <SectionHeader 
              variant="default"
              title="Executive Summary"
              level="h3"
            />
            <button 
              onClick={() => onNavigate('insights')}
              className="text-xs font-bold text-brand-purple hover:underline flex items-center gap-1 transition-all"
            >
              View full report <span className="text-sm">→</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Billing Insights Card — spans both columns */}
            <BillingInsightsCard onNavigate={onNavigate} />

            {/* Learners Card */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-blue-50/40 to-blue-50/20 border border-blue-100/80 shadow-sm flex flex-col justify-between min-h-[160px]">
              {/* Watermark */}
              <Users size={72} className="absolute -right-2 -top-2 text-blue-500/5 pointer-events-none transform -rotate-12" />

              <div className="flex items-center gap-2 z-10">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-100/80 text-blue-600">
                  <Users size={14} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-xs text-blue-800 tracking-wide uppercase">Learners</span>
              </div>

              <div className="flex justify-between items-end mt-4 z-10">
                <div className="space-y-0.5">
                  <div className="text-2xl font-black text-gray-955 tracking-tight leading-none">
                    {formatPercent(attendanceRate)}
                  </div>
                  <div className="text-[11px] text-gray-400 font-semibold tracking-wide uppercase">
                    Present today
                  </div>
                  <div className="text-xs font-bold text-blue-600 mt-2 flex items-center gap-1 pt-1">
                    <span>{stats.absentToday || 0}</span>
                    <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Absent</span>
                  </div>
                </div>

                <div className="w-20 h-10 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="learners-sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,28 C10,32 20,18 30,22 C45,28 55,12 65,18 C75,24 85,8 100,12"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,28 C10,32 20,18 30,22 C45,28 55,12 65,18 C75,24 85,8 100,12 L100,40 L0,40 Z"
                      fill="url(#learners-sparkline-grad)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Teachers Card */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-purple-50/40 to-purple-50/20 border border-purple-100/80 shadow-sm flex flex-col justify-between min-h-[160px]">
              {/* Watermark */}
              <Users size={72} className="absolute -right-2 -top-2 text-purple-500/5 pointer-events-none transform -rotate-12" />

              <div className="flex items-center gap-2 z-10">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-purple-100/80 text-purple-600">
                  <Users size={14} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-xs text-purple-800 tracking-wide uppercase">Teachers</span>
              </div>

              <div className="flex justify-between items-end mt-4 z-10">
                <div className="space-y-0.5">
                  <div className="text-2xl font-black text-gray-955 tracking-tight leading-none">
                    {formatPercent(teacherActiveRate)}
                  </div>
                  <div className="text-[11px] text-gray-400 font-semibold tracking-wide uppercase">
                    Active staff
                  </div>
                  <div className="text-xs font-bold text-purple-600 mt-2 flex items-center gap-1 pt-1">
                    <span>{inactiveTeachers}</span>
                    <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Inactive</span>
                  </div>
                </div>

                <div className="w-20 h-10 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="teachers-sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,30 C10,32 20,20 30,24 C45,30 55,14 65,20 C75,26 85,10 100,14"
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,30 C10,32 20,20 30,24 C45,30 55,14 65,20 C75,26 85,10 100,14 L100,40 L0,40 Z"
                      fill="url(#teachers-sparkline-grad)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Academics Card */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-orange-50/40 to-orange-50/20 border border-orange-100/80 shadow-sm flex flex-col justify-between min-h-[160px]">
              {/* Watermark */}
              <BookOpen size={72} className="absolute -right-2 -top-2 text-orange-500/5 pointer-events-none transform -rotate-12" />

              <div className="flex items-center gap-2 z-10">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-orange-100/80 text-orange-600">
                  <GraduationCap size={14} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-xs text-orange-800 tracking-wide uppercase">Academics</span>
              </div>

              <div className="flex justify-between items-end mt-4 z-10">
                <div className="space-y-0.5">
                  <div className="text-2xl font-black text-gray-955 tracking-tight leading-none">
                    {formatPercent(assessmentRate)}
                  </div>
                  <div className="text-[11px] text-gray-400 font-semibold tracking-wide uppercase">
                    Assessments complete
                  </div>
                  <div className="text-xs font-bold text-orange-600 mt-2 flex items-center gap-1 pt-1">
                    <span>{stats.totalMissedExams || 0}</span>
                    <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Classes pending</span>
                  </div>
                </div>

                <div className="w-20 h-10 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="academics-sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#F97316" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,32 C10,34 20,22 30,26 C45,32 55,16 65,22 C75,28 85,12 100,16"
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,32 C10,34 20,22 30,26 C45,32 55,16 65,22 C75,28 85,12 100,16 L100,40 L0,40 Z"
                      fill="url(#academics-sparkline-grad)"
                    />
                  </svg>
                </div>
              </div>
            </div>
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
