import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bookmark,
  BookOpen,
  Briefcase,
  Bus,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock,
  GraduationCap,
  Home,
  Lightbulb,
  Package,
  Settings,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardAPI, transportAPI } from '../../../services/api';
import { QuickActions } from '../shared';
import { useModuleAccess } from '../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../utils/appAccess';


const moduleToneMap = {
  fees: {
    border: 'border-green-500',
    lightBg: 'bg-green-50/70',
    footerBg: 'bg-green-100/50',
    solidBg: 'bg-green-600',
    text: 'text-green-800',
  },
  assessment: {
    border: 'border-blue-500',
    lightBg: 'bg-blue-50/70',
    footerBg: 'bg-blue-100/50',
    solidBg: 'bg-blue-600',
    text: 'text-blue-800',
  },
  attendance: {
    border: 'border-purple-500',
    lightBg: 'bg-purple-50/70',
    footerBg: 'bg-purple-100/50',
    solidBg: 'bg-purple-600',
    text: 'text-purple-800',
  },
  expenses: {
    border: 'border-red-500',
    lightBg: 'bg-red-50/70',
    footerBg: 'bg-red-100/50',
    solidBg: 'bg-red-600',
    text: 'text-red-800',
  },
  transport: {
    border: 'border-orange-400',
    lightBg: 'bg-orange-50/70',
    footerBg: 'bg-orange-100/50',
    solidBg: 'bg-orange-500',
    text: 'text-orange-800',
  },
  health: {
    border: 'border-teal-500',
    lightBg: 'bg-teal-50/70',
    footerBg: 'bg-teal-100/50',
    solidBg: 'bg-teal-600',
    text: 'text-teal-800',
  },
};

const currency = (value) => `KES ${Math.round(Number(value || 0)).toLocaleString()}`;
const integer = (value) => Math.round(Number(value || 0)).toLocaleString();
const percent = (value) => `${Math.round(Number(value || 0))}%`;
const decimal = (value) => Number(value || 0).toFixed(1);
const safeArray = (value) => (Array.isArray(value) ? value : []);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 9)   return { salutation: '🌅 Rise & shine', subtitle: 'A fresh day is here — your school is ready for you.' };
  if (h >= 9 && h < 12)  return { salutation: '☀️ Good morning', subtitle: 'Hope your morning is off to a great start. Here\'s your school at a glance.' };
  if (h >= 12 && h < 14) return { salutation: '🌞 Good afternoon', subtitle: 'Hope lunch is treating you well. Here\'s where things stand today.' };
  if (h >= 14 && h < 17) return { salutation: '🌤 Good afternoon', subtitle: 'The day is in full swing — check in on how things are going.' };
  if (h >= 17 && h < 20) return { salutation: '🌆 Good evening', subtitle: 'The school day is winding down. Here\'s your end-of-day overview.' };
  if (h >= 20 && h < 23) return { salutation: '🌙 Good evening', subtitle: 'Burning the midnight oil? Here\'s a quick look before you sign off.' };
  return { salutation: '🌟 Hello', subtitle: 'Working late? Your school data is always here for you.' };
};

const getDisplayName = (user, fallback = 'Administrator') => {
  const raw = user?.name || user?.firstName || user?.email?.split('@')[0] || fallback;
  return String(raw).trim().split(' ')[0] || fallback;
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

const getScoreTone = (score) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
};

const getScoreRing = (score) => {
  if (score >= 80) return 'from-emerald-500 to-emerald-300';
  if (score >= 60) return 'from-amber-500 to-yellow-300';
  return 'from-rose-500 to-rose-300';
};

const DashboardMetric = ({ label, value, note, trend, bgClass, icon: Icon }) => (
  <div className={`p-5 md:p-6 ${bgClass} text-white shadow-sm flex flex-col justify-center min-h-[110px]`}>
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-white/20 bg-white/10 rounded-xl">
        <Icon size={24} className="text-white/90" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">{label}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <p className="text-2xl md:text-3xl font-bold leading-tight">{value}</p>
          {trend ? (
            <span className="border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded">
              {trend}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-white/70">{note}</p>
      </div>
    </div>
  </div>
);

const SummaryValue = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2">
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

const DetailList = ({ items, emptyText = 'No records available yet.' }) => {
  if (!items.length) {
    return <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id || item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
            {item.note ? <p className="mt-1 text-xs text-slate-500">{item.note}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{item.value}</p>
            {item.meta ? <p className="mt-1 text-[11px] text-slate-500">{item.meta}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
};

const ChartCard = ({ title, subtitle, children }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
    <div className="mb-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
    <div className="h-64">{children}</div>
  </div>
);

const ExecutiveModuleCard = ({
  module,
  open,
  onToggle,
  expandedContent,
  outstandingByGrade = [],
  currency = (v) => `KES ${v}`,
  wrapperClassName = '',
}) => {
  const Icon = module.icon;
  const tone = moduleToneMap[module.id] || moduleToneMap.health;

  return (
    <div
      className={`rounded-2xl border ${tone.border} bg-white flex flex-col overflow-hidden transition-all duration-500 ${open ? 'shadow-lg' : 'shadow-sm'} ${wrapperClassName}`}
    >
      {/* Header Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left flex items-stretch justify-between focus:outline-none transition-colors hover:opacity-95 border-b border-slate-100 ${tone.lightBg}`}
      >
        <div className="flex items-center">
          <div className={`flex h-14 w-16 items-center justify-center rounded-br-[20px] ${tone.solidBg} text-white`}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
          <p className="ml-4 text-base font-bold text-slate-800">{module.title}</p>
        </div>
        <div className="pr-4 flex items-center">
          <ChevronRight size={18} className={`text-slate-600 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Card Body - Middle Content */}
      <div className="bg-white p-5 flex-grow flex flex-col justify-center">
        {module.id === 'health' ? (
          <div className="space-y-3 w-full">
            {module.summary.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full ${tone.solidBg} shrink-0`}></div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start justify-between divide-x divide-slate-100 w-full">
            {module.summary.map((item, idx) => (
              <div
                key={item.label}
                className={`flex-1 px-2 flex flex-col items-center text-center ${idx === 0 ? 'pl-0' : ''} ${idx === module.summary.length - 1 ? 'pr-0' : ''}`}
              >
                <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-bold text-slate-800">{item.value.replace('KES', 'KSh')}</p>
                {item.trend && (
                  <div
                    className={`flex items-center gap-0.5 text-xs font-bold mt-1 ${
                      item.trendDir === 'down' ? 'text-rose-600' : item.trendDir === 'neutral' ? 'text-slate-400' : 'text-emerald-600'
                    }`}
                  >
                    {item.trendDir === 'down' ? (
                      <TrendingDown size={12} strokeWidth={2.5} />
                    ) : item.trendDir === 'up' ? (
                      <TrendingUp size={12} strokeWidth={2.5} />
                    ) : (
                      ''
                    )}
                    <span>{item.trend}</span>
                  </div>
                )}
                {item.progress && (
                  <div className="w-full flex items-center justify-center mt-1.5">
                    <div className="h-1.5 w-full max-w-[64px] bg-slate-100 rounded-full overflow-hidden flex">
                      <div className={`h-full ${tone.solidBg}`} style={{ width: item.progress }}></div>
                    </div>
                  </div>
                )}
                {item.chart && (
                  <div className="flex items-center justify-center text-emerald-600 mt-1">
                    <TrendingUp size={18} strokeWidth={2.5} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center justify-between w-full px-5 py-2.5 border-t border-slate-100 ${tone.footerBg} focus:outline-none transition-colors hover:opacity-90`}
      >
        <p className={`text-xs font-semibold ${tone.text}`}>
          {open ? 'Hide detailed analytics' : 'Click to expand for detailed analytics'}
        </p>
        <ChevronRight size={14} className={`transition-transform duration-300 ${tone.text} ${open ? '-rotate-90' : ''}`} />
      </button>

      {/* Expanded Content Section */}
      {open && (
        <div className="border-t border-slate-200 bg-slate-50/30 p-5">
          {expandedContent}
        </div>
      )}
    </div>
  );
};

const ExecutiveMobileModuleCard = ({ module, onNavigate }) => {
  const Icon = module.icon;
  const tone = moduleToneMap[module.id] || moduleToneMap.health;
  const canNavigate = Boolean(module.path && onNavigate);

  const content = (
    <>
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-r-[26px] ${tone.solidBg} text-white shadow-sm`}>
        <Icon size={25} strokeWidth={2.5} />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4">
        <p className="truncate text-[15px] font-black text-slate-900">{module.title}</p>
        {canNavigate ? <ChevronRight size={18} className="shrink-0 text-slate-500" /> : null}
      </div>
    </>
  );

  const className = `flex min-h-[68px] w-full overflow-hidden rounded-2xl border ${tone.border} ${tone.lightBg} text-left shadow-sm transition active:scale-[0.99]`;

  if (!canNavigate) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(module.path)}
      className={`${className} focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
      aria-label={`Open ${module.title}`}
    >
      {content}
    </button>
  );
};


const ExecutiveOwnerDashboard = ({ user, onNavigate, brandingSettings, mode = 'desktop' }) => {
  const { activeSlugs } = useModuleAccess();
  const accessUser = useMemo(() => ({ ...(user || {}), enabledApps: activeSlugs }), [activeSlugs, user]);
  const [dashboard, setDashboard] = useState(null);
  const [transportSummary, setTransportSummary] = useState(null);
  const [transportReports, setTransportReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModule, setActiveModule] = useState('');
  const moduleSectionRef = useRef(null);
  const isMobile = mode === 'mobile';

  const { salutation, subtitle: greetingSubtitle } = getGreeting();
  const displayName = getDisplayName(user);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      const [dashboardResult, transportSummaryResult, transportReportsResult] = await Promise.allSettled([
        dashboardAPI.getAdminMetrics('term'),
        transportAPI.getSummary(),
        transportAPI.getReports(),
      ]);

      if (cancelled) return;

      if (dashboardResult.status === 'fulfilled' && dashboardResult.value?.success) {
        setDashboard(dashboardResult.value.data);
      } else {
        setError('Unable to load the executive dashboard right now.');
      }

      if (transportSummaryResult.status === 'fulfilled' && transportSummaryResult.value?.success) {
        setTransportSummary(transportSummaryResult.value.data);
      }

      if (transportReportsResult.status === 'fulfilled' && transportReportsResult.value?.success) {
        setTransportReports(transportReportsResult.value.data);
      }

      setLoading(false);
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = dashboard?.stats || {};
  const financials = dashboard?.financials || {};
  const expensesSummary = financials.expensesSummary || {};
  const transportFleet = transportReports?.fleetSummary || {};
  const transportBilling = transportReports?.billingTotals || {};
  const routeUtilisation = safeArray(transportReports?.routeUtilisation);
  const attendanceTrend = safeArray(dashboard?.attendanceTrend);
  const topClasses = safeArray(dashboard?.topPerformingClasses);
  const subjectProficiency = safeArray(dashboard?.distributions?.subjectProficiency);
  const recentPayments = safeArray(financials.recentPayments);
  const outstandingByGrade = safeArray(financials.streamBreakdown);
  const recentExpenses = safeArray(expensesSummary.recent);
  const expenseCategories = safeArray(expensesSummary.byCategory);
  const teacherAttendanceByDept = safeArray(dashboard?.teacherAttendanceByDept);
  const upcomingEvents = safeArray(dashboard?.upcomingEvents);

  const totalExpenses = Number(financials.totalExpenses || 0);
  const feeCollected = Number(stats.feeCollected || 0);
  const budgetUsagePct = feeCollected > 0 ? (totalExpenses / feeCollected) * 100 : 0;

  const collectionRate = useMemo(() => {
    const total = Number(stats.feeCollected || 0) + Number(stats.feePending || 0);
    return total > 0 ? (Number(stats.feeCollected || 0) / total) * 100 : 0;
  }, [stats.feeCollected, stats.feePending]);

  const assessmentCoverage = useMemo(() => {
    const breakdown = safeArray(dashboard?.unAssessedBreakdown);
    const total = breakdown.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const assessed = breakdown.reduce((sum, row) => sum + Number(row.assessed || 0), 0);
    return total > 0 ? (assessed / total) * 100 : 0;
  }, [dashboard?.unAssessedBreakdown]);

  const attendanceRate = Number(stats.avgAttendance || 0);
  const averageAssessmentScore = Number(stats.averageAssessmentScore || 0);
  const profitPosition = Number(financials.profitPosition ?? (feeCollected - totalExpenses));
  const profitMargin = feeCollected > 0 ? (profitPosition / feeCollected) * 100 : 0;
  const operationsScore = clampScore(((Number(stats.teacherAttendanceRate || 0) + Number(stats.staffAttendanceRate || 0)) / 2) || 0);

  const financeScore = clampScore((collectionRate * 0.65) + (profitMargin > 0 ? 25 : 10) + (Number(expensesSummary.pendingBills?.count || 0) === 0 ? 10 : 0));
  const academicsScore = clampScore((averageAssessmentScore * 0.75) + (assessmentCoverage * 0.25));
  const attendanceScore = clampScore((attendanceRate * 0.7) + (Number(stats.teacherAttendanceRate || 0) * 0.3));
  const schoolHealthScore = clampScore((financeScore * 0.35) + (academicsScore * 0.25) + (attendanceScore * 0.2) + (operationsScore * 0.2));

  const riskAlerts = [
    Number(stats.feePending || 0) > 0 ? { label: 'Outstanding fees need follow-up', value: currency(stats.feePending) } : null,
    Number(stats.atRiskStudents || 0) > 0 ? { label: 'At-risk learners flagged', value: integer(stats.atRiskStudents) } : null,
    Number(expensesSummary.pendingBills?.count || 0) > 0 ? { label: 'Pending bills awaiting settlement', value: integer(expensesSummary.pendingBills?.count) } : null,
    Number(transportSummary?.overCapacityRoutes?.length || 0) > 0 ? { label: 'Transport capacity alerts', value: integer(transportSummary.overCapacityRoutes.length) } : null,
  ].filter(Boolean);

  const weakestSubjects = [...subjectProficiency]
    .sort((a, b) => Number(b.be || 0) - Number(a.be || 0))
    .slice(0, 4);

  const topRoutes = [...routeUtilisation]
    .sort((a, b) => Number(b.fillPct || 0) - Number(a.fillPct || 0))
    .slice(0, 5);

  // Derive live trend labels
  const assessmentTrendDir = String(stats.assessmentTrend || '').startsWith('+') ? 'up' : String(stats.assessmentTrend || '').startsWith('-') ? 'down' : 'neutral';
  const totalTransportStudents = Number(transportFleet.totalStudents || transportSummary?.transportStudentCount || 0);
  const totalRoutes = Number(transportFleet.totalRoutes || transportSummary?.routeCount || 0);

  const collapsedModules = useMemo(() => [
    {
      id: 'fees',
      app: 'fee-management',
      path: 'fees-overview',
      title: 'Fees',
      icon: CircleDollarSign,
      summary: [
        { label: 'Total Collected', value: currency(feeCollected), trend: `${Math.round(collectionRate)}%`, trendDir: 'up' },
        { label: 'Outstanding', value: currency(stats.feePending), trend: percent(100 - collectionRate), trendDir: 'down' },
        { label: 'Collection Rate', value: percent(collectionRate), trendDir: collectionRate >= 80 ? 'up' : 'down' },
      ],
    },
    {
      id: 'assessment',
      app: 'gradebook',
      path: 'assess-mobile-dashboard',
      title: 'Assessment',
      icon: BarChart2,
      summary: [
        { label: 'Average Score', value: `${decimal(averageAssessmentScore)}%`, trend: stats.assessmentTrend || '—', trendDir: assessmentTrendDir },
        { label: 'Coverage', value: percent(assessmentCoverage), progress: `${Math.min(100, assessmentCoverage)}%` },
        { label: 'Classes Assessed', value: integer(stats.totalAssessedClasses), trendDir: 'neutral' },
      ],
    },
    {
      id: 'attendance',
      app: 'attendance',
      path: 'attendance-daily',
      title: 'Attendance',
      icon: Users,
      summary: [
        { label: "Today's Rate", value: percent(attendanceRate), trend: `${integer(stats.presentToday)} present`, trendDir: attendanceRate >= 85 ? 'up' : 'down' },
        { label: 'Absentees', value: integer(stats.absentToday), trend: `${integer(stats.lateToday || 0)} late`, trendDir: Number(stats.absentToday || 0) > 0 ? 'down' : 'neutral' },
      ],
    },
    {
      id: 'expenses',
      app: 'accounting',
      path: 'accounting-expenses',
      title: 'Expenses',
      icon: Wallet,
      summary: [
        { label: 'This Month', value: currency(expensesSummary.thisMonth), trendDir: 'neutral' },
        { label: 'Budget Load', value: percent(budgetUsagePct), progress: `${Math.min(100, budgetUsagePct)}%` },
        { label: 'Profit Position', value: currency(profitPosition), trendDir: profitPosition >= 0 ? 'up' : 'down' },
      ],
    },
    {
      id: 'transport',
      app: 'transport',
      path: 'transport-routes',
      title: 'Transport',
      icon: Bus,
      summary: [
        { label: 'Active Routes', value: integer(totalRoutes), trendDir: 'neutral' },
        { label: 'Riders', value: integer(totalTransportStudents), trendDir: totalTransportStudents > 0 ? 'up' : 'neutral' },
      ],
    },
    {
      id: 'health',
      app: null,
      title: 'Insights',
      icon: Lightbulb,
      summary: [
        { text: `Fee collection is ${collectionRate >= 80 ? 'on track' : 'below target'} at ${Math.round(collectionRate)}%. ${Number(stats.feePending || 0) > 0 ? `KSh ${Math.round(Number(stats.feePending || 0)).toLocaleString()} still outstanding.` : 'All fees cleared.'}` },
        { text: `Assessment average is ${decimal(averageAssessmentScore)}% — ${assessmentTrendDir === 'up' ? 'trending upward' : assessmentTrendDir === 'down' ? 'trending downward' : 'stable'}. Coverage: ${Math.round(assessmentCoverage)}%.` },
        { text: `Attendance today is ${Math.round(attendanceRate)}% (${integer(stats.presentToday)} present, ${integer(stats.absentToday)} absent). Teacher rate: ${Math.round(Number(stats.teacherAttendanceRate || 0))}%.` },
      ],
    },
  ].filter((module) => !module.app || hasPageAccess(accessUser, module.id === 'fees' ? 'fees-overview' : module.id === 'assessment' ? 'assess-mobile-dashboard' : module.id === 'attendance' ? 'attendance-daily' : module.id === 'expenses' ? 'accounting-expenses' : module.id === 'transport' ? 'transport-routes' : 'dashboard')), [
    accessUser,
    feeCollected,
    stats.feePending,
    collectionRate,
    averageAssessmentScore,
    stats.assessmentTrend,
    assessmentTrendDir,
    assessmentCoverage,
    stats.totalAssessedClasses,
    attendanceRate,
    stats.presentToday,
    stats.absentToday,
    stats.lateToday,
    expensesSummary.thisMonth,
    budgetUsagePct,
    profitPosition,
    totalRoutes,
    totalTransportStudents,
    stats.teacherAttendanceRate,
  ]);

  // Float the active/open module to the top of the list so it always renders first (full-width)
  const sortedModules = useMemo(() => {
    if (!activeModule) return collapsedModules;
    const active = collapsedModules.find((m) => m.id === activeModule);
    const rest = collapsedModules.filter((m) => m.id !== activeModule);
    return active ? [active, ...rest] : collapsedModules;
  }, [activeModule, collapsedModules]);

  const feesExpanded = (
    <div className="space-y-5">
      {/* Per-grade table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700">Fee Breakdown by Grade</p>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
            {outstandingByGrade.length} grades
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-5 py-3">Grade</th>
                <th className="px-5 py-3 text-right">Target</th>
                <th className="px-5 py-3 text-right">Collected</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3">Rate</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outstandingByGrade.length > 0 ? outstandingByGrade.map((row) => {
                const total = Number(row.collected || 0) + Number(row.bal || 0);
                const rate  = total > 0 ? (Number(row.collected || 0) / total) * 100 : 0;
                const hasBal = Number(row.bal || 0) > 0;
                return (
                  <tr key={row.grade || row.name} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">{row.name || row.grade}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-600">
                      {currency(row.target || total)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-emerald-700">
                      {currency(row.collected)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-rose-600">
                      {currency(row.bal)}
                    </td>
                    <td className="px-5 py-3.5 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${Math.max(3, Math.min(100, rate))}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 w-9 shrink-0">{Math.round(rate)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {hasBal ? (
                        <button
                          type="button"
                          onClick={() => onNavigate && onNavigate('admin-fees')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 active:scale-95"
                        >
                          Send Reminder
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-600">
                          ✓ Cleared
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400 italic">
                    No fee grade breakdown data available yet.
                  </td>
                </tr>
              )}
            </tbody>
            {outstandingByGrade.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">Totals</td>
                  <td className="px-5 py-3 text-right text-[11px] font-bold text-slate-700">
                    {currency(outstandingByGrade.reduce((s, r) => s + Number(r.target || (Number(r.collected || 0) + Number(r.bal || 0))), 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-[11px] font-bold text-emerald-700">
                    {currency(outstandingByGrade.reduce((s, r) => s + Number(r.collected || 0), 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-[11px] font-bold text-rose-600">
                    {currency(outstandingByGrade.reduce((s, r) => s + Number(r.bal || 0), 0))}
                  </td>
                  <td colSpan={2} className="px-5 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );


  const assessmentExpanded = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryValue label="Average Score" value={`${decimal(averageAssessmentScore)}%`} />
        <SummaryValue label="Assessment Trend" value={stats.assessmentTrend || '0%'} />
        <SummaryValue label="Coverage" value={percent(assessmentCoverage)} />
        <SummaryValue label="Assessed Classes" value={integer(stats.totalAssessedClasses)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="Performance by Grade" subtitle="Leading grade averages across the current reporting window">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topClasses}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={42} />
              <Tooltip formatter={(value) => `${decimal(value)}%`} />
              <Bar dataKey="avg" fill="#10b981" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Subject Analysis</p>
            <div className="mt-4 space-y-3">
              {subjectProficiency.map((subject) => (
                <div key={subject.area} className="rounded-2xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">{subject.area}</span>
                    <span className="text-sm font-semibold text-slate-900">{subject.ee}% strong</span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${subject.ee}%` }} />
                    <div className="bg-amber-400" style={{ width: `${subject.me}%` }} />
                    <div className="bg-rose-400" style={{ width: `${subject.be}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Weak Subjects</p>
          <div className="mt-4">
            <DetailList
              items={weakestSubjects.map((item) => ({
                id: item.area,
                label: item.area,
                value: `${item.be}% below expectation`,
                meta: `${item.ee}% exceeding`,
              }))}
              emptyText="No weak subject pattern detected yet."
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Term Comparison</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">Current Window</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{decimal(averageAssessmentScore)}%</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Trend</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{stats.assessmentTrend || '0%'}</p>
              <p className="mt-1 text-xs text-slate-500">Based on current vs previous reporting window averages</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const attendanceExpanded = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryValue label="Today Present" value={integer(stats.presentToday)} />
        <SummaryValue label="Absentees" value={integer(stats.absentToday)} />
        <SummaryValue label="Teacher Attendance" value={percent(stats.teacherAttendanceRate)} />
        <SummaryValue label="Support Staff Attendance" value={percent(stats.staffAttendanceRate)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ChartCard title="Attendance Trends" subtitle="Learner attendance trend across recent sessions">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={attendanceTrend}>
              <defs>
                <linearGradient id="attendanceTrend" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(value) => `${decimal(value)}%`} />
              <Area type="monotone" dataKey="attendanceRate" stroke="#8b5cf6" strokeWidth={2} fill="url(#attendanceTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Staff Attendance</p>
            <div className="mt-4">
              <DetailList
                items={teacherAttendanceByDept.map((item) => ({
                  id: item.department || item.label,
                  label: item.department || item.label || 'Department',
                  value: percent(item.attendanceRate || item.rate || 0),
                  meta: `${integer(item.present || 0)} present`,
                }))}
                emptyText="Department attendance detail is not available yet."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Class-by-Class Breakdown</p>
          <div className="mt-4">
            <DetailList
              items={safeArray(dashboard?.distributions?.studentsByGrade).slice(0, 6).map((item) => ({
                id: item.label,
                label: item.label,
                value: `${integer(item.value)} learners`,
                meta: 'Population context for attendance follow-up',
              }))}
              emptyText="Class population data unavailable."
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Operational Notes</p>
          <div className="mt-4 space-y-3">
            <SummaryValue label="Late Arrivals" value={integer(stats.lateToday)} />
            <SummaryValue label="Chronic Absenteeism Signal" value={integer(stats.atRiskStudents)} />
            <SummaryValue label="Upcoming Events" value={integer(upcomingEvents.length)} />
          </div>
        </div>
      </div>
    </div>
  );

  const expensesExpanded = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryValue label="Today" value={currency(expensesSummary.today)} />
        <SummaryValue label="This Month" value={currency(expensesSummary.thisMonth)} />
        <SummaryValue label="This Term" value={currency(expensesSummary.thisTerm)} />
        <SummaryValue label="Pending Bills" value={`${integer(expensesSummary.pendingBills?.count)} · ${currency(expensesSummary.pendingBills?.amount)}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="Expense Categories" subtitle="Largest spend areas for the current term">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenseCategories}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
              <Tooltip formatter={(value) => currency(value)} />
              <Bar dataKey="amount" fill="#f59e0b" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Budget vs Actual</p>
          <p className="mt-1 text-xs text-slate-500">Using collected revenue as the current operating benchmark</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Expense load</span>
                <span className="font-semibold text-slate-900">{percent(feeCollected > 0 ? (totalExpenses / feeCollected) * 100 : 0)}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.min(100, Math.max(6, feeCollected > 0 ? (totalExpenses / feeCollected) * 100 : 0))}%` }}
                />
              </div>
            </div>
            <SummaryValue label="Profit Position" value={currency(profitPosition)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Top Expenditures</p>
          <div className="mt-4">
            <DetailList
              items={recentExpenses.slice(0, 5).map((item) => ({
                id: item.id,
                label: item.description,
                note: `${item.category} · ${item.account}`,
                value: currency(item.amount),
                meta: new Date(item.date).toLocaleDateString(),
              }))}
              emptyText="No recent expenses were found."
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Department Breakdown</p>
          <div className="mt-4">
            <DetailList
              items={expenseCategories.slice(0, 6).map((item) => ({
                id: item.category,
                label: item.category,
                value: currency(item.amount),
                meta: `${Math.round((Number(item.amount || 0) / Math.max(totalExpenses, 1)) * 100)}% of term spend`,
              }))}
              emptyText="Department spend breakdown not available."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const transportExpanded = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryValue label="Vehicles" value={integer(transportFleet.totalVehicles || transportSummary?.vehicleCount)} />
        <SummaryValue label="Total Capacity" value={integer(transportFleet.totalCapacity)} />
        <SummaryValue label="Assigned Riders" value={integer(transportFleet.totalAssigned || transportSummary?.assignmentCount)} />
        <SummaryValue label="Collection Rate" value={percent(transportBilling.collectionRate)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="Route Efficiency" subtitle="Route occupancy across active fleet">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topRoutes}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(value) => `${value}% full`} />
              <Bar dataKey="fillPct" fill="#06b6d4" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Transport Alerts</p>
          <div className="mt-4 space-y-3">
            <SummaryValue label="Over Capacity Routes" value={integer(transportFleet.overCapacity || transportSummary?.overCapacityRoutes?.length)} />
            <SummaryValue label="Fuel Usage" value="Tracking not configured" />
            <SummaryValue label="Maintenance Alerts" value={transportFleet.overCapacity > 0 ? 'Review overloaded fleet' : 'No maintenance feed connected'} />
            <SummaryValue label="Driver Coverage" value={`${integer(topRoutes.filter((route) => route.vehicle?.driverName).length)} assigned`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Bus Occupancy</p>
          <div className="mt-4">
            <DetailList
              items={topRoutes.map((route) => ({
                id: route.id,
                label: route.name,
                note: route.vehicle?.registrationNumber || 'Vehicle pending assignment',
                value: `${route.assigned}/${route.capacity || '-'} riders`,
                meta: `${route.fillPct || 0}% occupied`,
              }))}
              emptyText="No transport routes are configured yet."
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Driver Activity</p>
          <div className="mt-4">
            <DetailList
              items={topRoutes.map((route) => ({
                id: `${route.id}-driver`,
                label: route.vehicle?.driverName || 'Driver not assigned',
                note: route.name,
                value: route.vehicle?.driverPhone || 'No phone',
                meta: route.vehicle?.status || 'UNASSIGNED',
              }))}
              emptyText="Driver activity will appear once routes and drivers are assigned."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const healthExpanded = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryValue label="Finance Score" value={`${financeScore}/100`} />
        <SummaryValue label="Academics Score" value={`${academicsScore}/100`} />
        <SummaryValue label="Attendance Score" value={`${attendanceScore}/100`} />
        <SummaryValue label="Operations Score" value={`${operationsScore}/100`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-5">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${getScoreRing(schoolHealthScore)} text-white shadow-lg`}>
              <div className="text-center">
                <div className="text-3xl font-bold">{schoolHealthScore}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">Health</div>
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">School Health Insight</p>
              <p className="mt-1 text-sm text-slate-500">A blended score across finance, academics, attendance, and operational coverage.</p>
              <p className={`mt-3 text-sm font-semibold ${getScoreTone(schoolHealthScore)}`}>
                {schoolHealthScore >= 80 ? 'School performance is healthy and stable.' : schoolHealthScore >= 60 ? 'School performance is stable but needs attention in a few areas.' : 'School performance needs executive intervention.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Risk Alerts</p>
          <div className="mt-4">
            <DetailList
              items={riskAlerts.map((item, index) => ({
                id: `${item.label}-${index}`,
                label: item.label,
                value: item.value,
              }))}
              emptyText="No active risk alerts right now."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const expandedModules = {
    fees: feesExpanded,
    assessment: assessmentExpanded,
    attendance: attendanceExpanded,
    expenses: expensesExpanded,
    transport: transportExpanded,
    health: healthExpanded,
  };

  if (error && !dashboard) {
    return (
      <div className={`${isMobile ? 'px-4 pt-4 pb-24' : 'px-6 py-6'}`}>
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Dashboard unavailable</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const heroCards = [
    {
      label: 'Total Students',
      value: integer(stats.activeLearners),
      note: `${integer(stats.activeLearners)} active | ${stats.totalBoys || 0} Male / ${stats.totalGirls || 0} Female`,
      trend: stats.activeLearners > 0 ? `+${integer(stats.activeLearners)}` : '0',
      bgClass: 'bg-[#1a237e]',
      icon: Users,
    },
    {
      label: 'Outstanding Balance',
      value: currency(stats.feePending),
      note: `${Math.round(100 - collectionRate)}% uncollected · ${integer(outstandingByGrade.length)} grade streams`,
      trend: `-${Math.round(100 - collectionRate)}%`,
      bgClass: 'bg-[#109B82]',
      icon: AlertTriangle,
    },
    {
      label: 'Total Expenses',
      value: currency(totalExpenses),
      note: `${currency(expensesSummary.thisMonth || 0)} this month · ${integer(expensesSummary.pendingBills?.count || 0)} pending`,
      trend: `${Math.round(budgetUsagePct)}% of rev`,
      bgClass: 'bg-[#e11d48]',
      icon: Wallet,
    },
    {
      label: 'Revenue Collected',
      value: currency(feeCollected),
      note: `${Math.round(collectionRate)}% collection rate · ${currency(expensesSummary.thisMonth || 0)} spent`,
      trend: `${Math.round(collectionRate)}%`,
      bgClass: 'bg-[#059669]',
      icon: CircleDollarSign,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Greeting header — design system style matching SuperAdmin console */}
      <div className={`${isMobile ? 'px-4 pt-5 pb-4' : 'px-6 lg:px-10 pt-7 pb-4'} bg-white border-b border-slate-200 flex items-center justify-between gap-4`}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">School Dashboard</p>
          <h1 className="mt-1.5 text-xl font-black text-slate-950">{salutation}, {displayName}!</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Today is{' '}
            <span className="font-bold text-slate-700">
              {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}
            </span>
            {' '}· {greetingSubtitle}
          </p>
        </div>
        {loading && (
          <span className="text-xs font-semibold text-slate-400 animate-pulse shrink-0">Refreshing…</span>
        )}
      </div>

      {/* Quick Actions navigation strip */}
      <QuickActions onNavigate={onNavigate} currentPage="dashboard" user={accessUser} />

      {/* Hero Metric Cards — temporarily hidden */}
      {false && (
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-slate-200">
        {heroCards.map((item) => (
          <DashboardMetric
            key={item.label}
            label={item.label}
            value={item.value}
            note={item.note}
            trend={item.trend}
            bgClass={item.bgClass}
            icon={item.icon}
          />
        ))}
      </section>
      )}

      <div className={`${isMobile ? 'px-4 pt-5' : 'px-6 lg:px-10 pt-8'} space-y-8 pb-10`}>
        {/* Module Section */}
        <section ref={moduleSectionRef} className="space-y-5">

          {/* Grid: active card floats to top (col-span-full), rest fill below in 2-3 col layout */}
          <div className={isMobile ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3'}>
            {sortedModules.map((module) => {
              if (isMobile) {
                return <ExecutiveMobileModuleCard key={module.id} module={module} onNavigate={onNavigate} />;
              }

              const isActive = activeModule === module.id;
              return (
                <ExecutiveModuleCard
                  key={module.id}
                  module={module}
                  open={isActive}
                  onToggle={() => setActiveModule((current) => (current === module.id ? '' : module.id))}
                  expandedContent={expandedModules[module.id]}
                  outstandingByGrade={outstandingByGrade}
                  currency={currency}
                  wrapperClassName={isActive ? 'col-span-1 xl:col-span-2 2xl:col-span-3' : ''}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ExecutiveOwnerDashboard;
