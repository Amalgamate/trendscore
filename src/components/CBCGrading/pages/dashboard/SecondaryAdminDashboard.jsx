/**
 * Secondary School Admin Dashboard
 *
 * Distinct visual identity from Junior (PRIMARY_CBC):
 *   Junior   → --brand-purple (#6d28d9) / --brand-teal (#0d9488)  warm purple palette
 *   Secondary → deep violet (#4c1d95) / amber (#b45309) / cyan (#0e7490) — richer, darker
 *
 * Layout (mirrors Junior structure, different palette):
 *  1. Quick-action icon row
 *  2. Tab strip  (7 tabs — violet underline, not brand-purple)
 *  3. Coloured metric banner  (4 cards: violet / cyan / rose / amber)
 *  4. Doughnut + bar charts
 *  5. Activity log + Operations Hub
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
} from 'recharts';
import { hasPageAccess } from '../../utils/appAccess';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import {
  Users, GraduationCap, BookOpen, UserCheck, Calendar, Award,
  AlertCircle, CheckCircle, ArrowUp, ArrowDown, Download,
  Wallet, Settings, Activity, ChevronRight, TrendingUp,
  FileText, Clock, Briefcase, X, Filter, UserPlus, Receipt,
  ClipboardCheck, Package,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   PALETTE  — Secondary / Senior School
   Kept entirely separate from Junior CSS vars so neither dashboard affects the other.
───────────────────────────────────────────────────────────────────────────── */
const P = {
  /* Card backgrounds (metric banner) */
  card1: '#4c1d95',   // violet-900  — Total students
  card2: '#0e7490',   // cyan-700    — Exam series
  card3: '#9f1239',   // rose-900    — Un-assessed
  card4: '#92400e',   // amber-800   — Assessed classes

  /* Chart colours */
  c1:  '#7c3aed',     // violet-600
  c2:  '#0891b2',     // cyan-600
  c3:  '#f59e0b',     // amber-400
  c4:  '#f43f5e',     // rose-500
  c5:  '#10b981',     // emerald-500

  /* Tab accent */
  tab:   '#6d28d9',   // violet-700

  /* Misc */
  ok:    '#10b981',
  warn:  '#f59e0b',
  danger:'#f43f5e',
};

/* ─── Metric Banner ──────────────────────────────────────────────────────── */
const MetricBanner = ({ metrics }) => {
  const tones = ['indigo', 'teal', 'rose', 'orange'];
  return (
    <DashboardSummary
      title="Executive Summary"
      description="Senior school operating position at a glance."
      items={metrics.map((metric, index) => {
        const Icon = metric.icon;
        return {
          label:    metric.title,
          value:    metric.value,
          subvalue: metric.subvalue ?? metric.subtitle,
          chips:    metric.chips,
          trend:    metric.trend,
          trendValue: metric.trendValue,
          icon:     <Icon size={26} />,
          tone:     tones[index] || 'navy',
          onClick:  metric.onClick,
        };
      })}
    />
  );
};

/* ─── Tab Button ─────────────────────────────────────────────────────────── */
const TabBtn = ({ active, label, icon: Icon, onClick }) => (
  <button
    onClick={onClick}
    style={active ? { borderBottomColor: P.tab, color: P.tab } : {}}
    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 whitespace-nowrap
      ${active
        ? 'border-b-2 bg-violet-50/60'
        : 'border-transparent text-gray-500 hover:text-violet-700 hover:bg-violet-50/40'}`}
  >
    <Icon size={15} />
    {label}
  </button>
);

/* ─── Inline Metric Card (sub-tab use) ───────────────────────────────────── */
const Card = ({ title, value, subtitle, icon: Icon }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
    <div className="flex justify-between items-start mb-3">
      <div className="p-3 rounded-lg bg-violet-50 border border-violet-100">
        <Icon size={18} className="text-violet-700" />
      </div>
    </div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
    <h3 className="text-2xl font-semibold text-gray-900 mt-1">{value}</h3>
    {subtitle && <p className="text-[10px] font-medium text-gray-500 mt-1 truncate opacity-75">{subtitle}</p>}
  </div>
);

/* ─── Chart wrapper ──────────────────────────────────────────────────────── */
const ChartPanel = ({ title, badge, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">{title}</h3>
      {badge}
    </div>
    {children}
  </div>
);

/* ─── Activity Log Row ───────────────────────────────────────────────────── */
const LogRow = ({ date, category, description, status, color }) => (
  <tr className="hover:bg-violet-50/30 transition-colors">
    <td className="px-5 py-3.5 text-[11px] text-gray-400 font-medium whitespace-nowrap">{date}</td>
    <td className="px-5 py-3.5">
      <span style={{ color }} className="text-[11px] font-bold flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
        {category}
      </span>
    </td>
    <td className="px-5 py-3.5 text-[11px] font-medium text-gray-700 max-w-xs truncate">{description}</td>
    <td className="px-5 py-3.5">
      {status === 'Verified' && (
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-bold uppercase tracking-widest text-[9px]">Verified</span>
      )}
      {status === 'Graded' && (
        <span className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-full font-bold uppercase tracking-widest text-[9px]">Graded</span>
      )}
      {status === 'Calculated' && (
        <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-full font-bold uppercase tracking-widest text-[9px]">Calculated</span>
      )}
    </td>
  </tr>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const SecondaryAdminDashboard = ({ learners = [], pagination, teachers = [], user, onNavigate }) => {
  const [activeTab, setActiveTab]             = useState('overview');
  const [refreshing, setRefreshing]           = useState(false);
  const [metrics, setMetrics]                 = useState(null);
  const [apiError, setApiError]               = useState(null);
  const [timeFilter]                          = useState('term');
  const [showUnAssessedSheet, setShowUnAssessedSheet] = useState(false);
  const [insights, setInsights]               = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('secondary-admin', [
    { id: 'quick-actions', label: 'Quick Actions', description: 'Senior school shortcuts' },
    { id: 'tab-navigation', label: 'Tab Navigation', description: 'Overview, finance, performance, operations' },
    { id: 'tab-content', label: 'Active Tab Content', description: 'Current dashboard tab panels' },
  ]);

  /* ── Quick actions ─────────────────────────────────────────────────────── */
  const visibleShortcuts = [
    { label: 'Admissions',   icon: UserPlus,       color: 'bg-violet-700 text-white',  path: 'learners-admissions' },
    { label: 'Collect Fees', icon: Receipt,         color: 'bg-cyan-700 text-white',    path: 'fees-collection' },
    { label: 'Attendance',   icon: ClipboardCheck,  color: 'bg-amber-600 text-white',   path: 'attendance-daily' },
    { label: 'Assessments',  icon: BookOpen,        color: 'bg-rose-700 text-white',    path: 'assess-summative-assessment' },
    { label: 'Inventory',    icon: Package,         color: 'bg-teal-700 text-white',    path: 'inventory-items' },
    { label: 'Settings',     icon: Settings,        color: 'bg-slate-700 text-white',   path: 'settings-academic' },
  ].filter(s => hasPageAccess(user, s.path));

  const visibleOperations = [
    { label: 'Register New Student',        icon: Users,         page: 'learners-admissions' },
    { label: 'Manage Staff Directory',      icon: GraduationCap, page: 'teachers-list' },
    { label: 'Academic Term Settings',      icon: BookOpen,      page: 'settings-academic' },
    { label: 'Financial Statements',        icon: FileText,      page: 'accounting-reports' },
    { label: 'Pathway Progress Overview',    icon: TrendingUp, page: 'sec-pathway-overview'   },
    { label: 'Pathway Counsellor Workbench', icon: Activity,   page: 'sec-pathway-counsellor' },
  ].filter(a => hasPageAccess(user, a.page));

  /* ── Data loading ──────────────────────────────────────────────────────── */
  const loadMetrics = async () => {
    try {
      setRefreshing(true);
      setApiError(null);
      const res = await dashboardAPI.getAdminMetrics(timeFilter);
      if (res.success) setMetrics(res.data);
      else setApiError(res.message || 'Failed to load dashboard data');
    } catch (err) {
      setApiError(err.message || 'Could not reach server. Please retry.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadMetrics(); }, [userId]); // eslint-disable-line

  const loadInsights = async () => {
    try {
      setInsightsLoading(true);
      const res = await dashboardAPI.getInsights(false);
      if (res.success) setInsights(res.data);
      else setInsights(null);
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai-insights' && !insights && !insightsLoading) loadInsights();
  }, [activeTab]); // eslint-disable-line

  /* ── Derived stats ─────────────────────────────────────────────────────── */
  const stats = {
    totalStudents:            metrics?.stats?.totalStudents            || pagination?.total || learners.length || 0,
    activeStudents:           metrics?.stats?.activeStudents           || learners.filter(l => l.status === 'ACTIVE').length || 0,
    totalTeachers:            metrics?.stats?.totalTeachers            || teachers.length || 0,
    activeTeachers:           metrics?.stats?.activeTeachers          || teachers.filter(t => t.status === 'ACTIVE').length || 0,
    males:                    metrics?.stats?.males                    || learners.filter(l => (l.gender||'').toLowerCase().startsWith('m')).length || 0,
    females:                  metrics?.stats?.females                  || learners.filter(l => (l.gender||'').toLowerCase().startsWith('f')).length || 0,
    presentToday:             metrics?.stats?.presentToday             || 0,
    absentToday:              metrics?.stats?.absentToday              || 0,
    totalClasses:             metrics?.stats?.totalClasses             || 0,
    totalAssessedClasses:     metrics?.stats?.totalAssessedClasses     || 0,
    totalMissedExams:         metrics?.stats?.totalMissedExams         || 0,
    currentTestSeries:        metrics?.stats?.currentTestSeries        || 'Current Series',
    feeCollected:             metrics?.stats?.feeCollected             || 0,
    feePending:               metrics?.stats?.feePending               || 0,
    studentTrend:             metrics?.stats?.studentTrend,
    atRiskStudents:           metrics?.stats?.atRiskStudents           || 0,
    totalPendingAssessments:  metrics?.stats?.totalPendingAssessments  || 0,
  };

  /* Chart datasets */
  const attendanceData = (() => {
    const d = [
      { name: 'Present Today', value: stats.presentToday,  color: P.c2 },
      { name: 'Absent',        value: stats.absentToday,   color: P.danger },
    ];
    if (d[0].value === 0 && d[1].value === 0) { d[0].value = stats.activeStudents || 1; d[0].name = 'Enrolled'; }
    return d;
  })();

  const assessmentData = [
    { name: 'Assessed',    value: Math.max(0, stats.totalStudents - stats.totalMissedExams), color: P.c1 },
    { name: 'Unassessed',  value: stats.totalMissedExams,                                    color: P.danger },
  ];

  const financeData     = (metrics?.financials?.streamBreakdown || []).map(r => ({ name: r.name, collected: r.collected || 0, pending: r.bal || 0 }));
  const proficiencyData = (metrics?.distributions?.subjectProficiency || []).map(r => ({ name: r.area, ee: r.ee || 0, me: r.me || 0, be: r.be || 0 }));
  const calendarEvents  = metrics?.upcomingEvents || [];

  /* ── Loading skeleton ──────────────────────────────────────────────────── */
  if (refreshing && !metrics && !learners.length && !teachers.length) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 lg:gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-violet-100 rounded-xl" />)}
        </div>
        <div className="h-10 w-96 bg-violet-100 rounded-lg" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-violet-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (apiError && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-6 bg-violet-50 border border-violet-200 rounded-2xl max-w-md">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="text-base font-semibold text-violet-900 mb-1">Dashboard warming up</h3>
          <p className="text-xs text-violet-700 mb-4">{apiError}</p>
          <button onClick={loadMetrics} className="px-6 py-2 bg-violet-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-violet-800 transition">
            Retry Now
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TAB RENDERERS
  ═══════════════════════════════════════════════════════════════════════ */

  /* ── Overview ─────────────────────────────────────────────────────────── */
  const renderOverview = () => {
    const bannerMetrics = [
      {
        title: 'Total Students', value: stats.totalStudents,
        subvalue: `${stats.activeStudents} active`,
        chips: [
          { value: stats.males,   label: 'Male',   dot: '#38bdf8' },
          { value: stats.females, label: 'Female', dot: '#f9a8d4' },
        ],
        icon: Users, trend: stats.studentTrend?.startsWith('+') ? 'up' : 'down',
        trendValue: stats.studentTrend, onClick: () => onNavigate('learners-list'),
      },
      {
        title: 'Current Exam Series', value: stats.currentTestSeries,
        subvalue: 'Assessment Period',
        chips: [
          { value: stats.totalMissedExams, label: 'Unassessed', dot: '#fca5a5' },
          { value: stats.totalAssessedClasses, label: 'Classes Done', dot: '#86efac' },
        ],
        icon: GraduationCap,
        onClick: () => onNavigate('assess-summary-report'),
      },
      {
        title: 'Total Un-Assessed', value: stats.totalMissedExams,
        subvalue: stats.currentTestSeries,
        chips: [
          { value: stats.totalStudents, label: 'Total',    dot: '#c4b5fd' },
          { value: Math.max(0, stats.totalStudents - stats.totalMissedExams), label: 'Assessed', dot: '#86efac' },
        ],
        icon: AlertCircle,
        onClick: () => setShowUnAssessedSheet(true),
      },
      {
        title: 'Assessed Classes', value: stats.totalAssessedClasses,
        subvalue: 'With recorded data',
        chips: [
          { value: stats.totalClasses,         label: 'Total Classes', dot: '#c4b5fd' },
          { value: stats.totalAssessedClasses,  label: 'Assessed',     dot: '#86efac' },
        ],
        icon: UserCheck,
        onClick: () => onNavigate('assess-summative-assessment'),
      },
    ];

    if (!metrics) {
      return (
        <div className="space-y-6">
          <MetricBanner metrics={bannerMetrics} />
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
            <p className="text-[10px] font-bold text-cyan-700 uppercase tracking-widest">Live Sync</p>
            <p className="mt-1 text-xs text-gray-600">Showing instant snapshot while full analytics load in the background.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <MetricBanner metrics={bannerMetrics} />

        {/* ── 4. Charts row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Doughnut: Daily Attendance */}
          <ChartPanel title="Daily Attendance">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attendanceData} cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                    paddingAngle={5} dataKey="value" stroke="none">
                    {attendanceData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} itemStyle={{ fontSize: 12, fontWeight: 600 }} />
                  <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          {/* Doughnut: Assessment Fulfillment */}
          <ChartPanel title="Assessment Fulfillment"
            badge={stats.totalMissedExams > 0 && (
              <span className="text-[9px] font-bold uppercase text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">Action Req</span>
            )}>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={assessmentData} cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                    paddingAngle={5} dataKey="value" stroke="none">
                    {assessmentData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} itemStyle={{ fontSize: 12, fontWeight: 600 }} />
                  <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          {/* Bar: Uncollected Balances */}
          <ChartPanel title="Uncollected Balances">
            <div className="h-48">
              {financeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeData} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-8} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                    <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                    <Bar dataKey="collected" name="Collected"  fill={P.c2}     radius={0} barSize={12} stackId="a" />
                    <Bar dataKey="pending"   name="Pending"    fill={P.danger} radius={0} barSize={12} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">No Financial Data</div>
              )}
            </div>
          </ChartPanel>
        </div>

        {/* ── 5. Activity log + Operations Hub ───────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Activity Log */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-50/60 to-white">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-violet-600" />
                <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">Recent Activity Log</h3>
              </div>
              <button className="text-[10px] font-bold text-violet-700 hover:underline uppercase tracking-widest flex items-center gap-1">
                <Download size={11} /> Audit Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-violet-50/50 text-[10px] uppercase tracking-wider text-violet-600 font-bold">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Activity</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {metrics?.recentActivity?.admissions?.slice(0, 5).map((s, idx) => (
                    <LogRow
                      key={`adm-${idx}`}
                      date={new Date(s.createdAt).toLocaleDateString()}
                      category="Admission"
                      description={`${s.firstName} ${s.lastName} enrolled`}
                      status="Verified"
                      color={P.c2}
                    />
                  ))}
                  {metrics?.recentActivity?.assessments?.slice(0, 5).map((a, idx) => (
                    <LogRow
                      key={`as-${idx}`}
                      date={new Date(a.createdAt).toLocaleDateString()}
                      category={a.type || 'Assessment'}
                      description={`${a.title} — ${a.learner?.firstName} ${a.learner?.lastName}`}
                      status={a.type === 'SUMMATIVE' ? 'Graded' : 'Calculated'}
                      color={a.type === 'SUMMATIVE' ? P.c1 : P.c3}
                    />
                  ))}
                  {!metrics?.recentActivity?.admissions?.length && !metrics?.recentActivity?.assessments?.length && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-400 text-xs italic">No activity recorded for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operations Hub + Alerts */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Briefcase size={13} className="text-violet-600" /> Operations Hub
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {visibleOperations.map((op, idx) => (
                  <button
                    key={idx}
                    onClick={() => onNavigate(op.page)}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-violet-400 hover:bg-violet-50/50 group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <op.icon size={16} className="text-gray-400 group-hover:text-violet-700" />
                      <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">{op.label}</span>
                    </div>
                    <ChevronRight size={13} className="text-gray-300 group-hover:text-violet-700" />
                  </button>
                ))}
              </div>
            </div>

            {/* System Alerts */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-[11px] font-bold text-amber-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <AlertCircle size={13} /> System Alerts
              </h3>
              <div className="flex gap-3">
                <div className="w-1 rounded-full bg-amber-400 self-stretch" />
                <div>
                  <p className="text-[11px] font-semibold text-amber-900">
                    {stats.totalPendingAssessments} Pending Assessments
                  </p>
                  <p className="text-[9px] text-amber-700 uppercase font-bold tracking-wider mt-0.5">Requires Head Teacher Review</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Financials ───────────────────────────────────────────────────────── */
  const renderFinancials = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Revenue"   value={`KES ${stats.feeCollected.toLocaleString()}`} icon={Wallet}    subtitle="Termly Collection" />
        <Card title="Outstandings"    value={`KES ${stats.feePending.toLocaleString()}`}   icon={TrendingUp} subtitle="Pending Payments" />
        <Card title="Collection Rate" value={`${Math.round((stats.feeCollected / ((stats.feeCollected + stats.feePending) || 1)) * 100)}%`} icon={Activity} />
      </div>

      <ChartPanel title="Financial Collection Risk"
        badge={stats.feePending > 0 && <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Action Required</span>}>
        <div className="h-64">
          {financeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                <Bar dataKey="collected" name="Collected" fill={P.c2}     stackId="a" />
                <Bar dataKey="pending"   name="Pending"   fill={P.danger} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">No Financial Data</div>
          )}
        </div>
      </ChartPanel>

      {/* Revenue table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-50/40 to-white">
          <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">Revenue Breakdown by Stream</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-white border border-gray-200 rounded text-[10px] font-semibold uppercase hover:bg-gray-50 flex items-center gap-1"><Download size={11} /> XLS</button>
            <button className="px-3 py-1 bg-white border border-gray-200 rounded text-[10px] font-semibold uppercase hover:bg-gray-50 flex items-center gap-1"><FileText size={11} /> PDF</button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-violet-50 text-[10px] font-bold text-violet-800 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-3">Grade Category</th>
              <th className="px-6 py-3 text-right">Target</th>
              <th className="px-6 py-3 text-right">Collected</th>
              <th className="px-6 py-3 text-right">Balance</th>
              <th className="px-6 py-3">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(metrics?.financials?.streamBreakdown || []).map((row, idx) => (
              <tr key={idx} className="text-xs font-semibold text-gray-700 hover:bg-violet-50/30 transition-colors">
                <td className="px-6 py-4">{row.name}</td>
                <td className="px-6 py-4 text-right">KES {row.target?.toLocaleString()}</td>
                <td className="px-6 py-4 text-right">KES {row.collected?.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-rose-600">KES {row.bal?.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-violet-500 h-full rounded-full" style={{ width: `${row.target > 0 ? (row.collected / row.target) * 100 : 0}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {!metrics?.financials?.streamBreakdown?.length && (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400 text-xs italic">No financial data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── Academic Performance ─────────────────────────────────────────────── */
  const renderPerformance = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50/40 to-white">
            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">Ranking by Academic Average</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-violet-50 text-[10px] font-bold text-violet-800 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Grade Unit</th>
                <th className="px-6 py-3 text-right">Avg</th>
                <th className="px-6 py-3 text-right">Proficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(metrics?.topPerformingClasses || []).map((cls, idx) => (
                <tr key={idx} className="text-xs font-medium text-gray-700 hover:bg-violet-50/30 transition-colors">
                  <td className="px-6 py-4 text-gray-400 font-bold">#{String(idx + 1).padStart(2, '0')}</td>
                  <td className="px-6 py-4 text-gray-900 font-semibold">{cls.grade}</td>
                  <td className="px-6 py-4 text-right font-semibold">{cls.avg}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-[10px] font-semibold">{cls.label}</span>
                  </td>
                </tr>
              ))}
              {!metrics?.topPerformingClasses?.length && (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 text-xs italic">Not enough data for rankings</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <ChartPanel title="Subject Proficiency Distribution">
          <div className="h-72">
            {proficiencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proficiencyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} width={90} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                  <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  <Bar dataKey="ee" name="Exceeding"         fill={P.c1}     stackId="a" />
                  <Bar dataKey="me" name="Meeting"            fill={P.c2}     stackId="a" />
                  <Bar dataKey="be" name="Below Expectation"  fill={P.danger} stackId="a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">No Proficiency Data</div>
            )}
          </div>
        </ChartPanel>
      </div>
    </div>
  );

  /* ── School Operations ────────────────────────────────────────────────── */
  const renderOperations = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50/40 to-white">
            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">Academic Calendar & Milestones</h3>
          </div>
          {calendarEvents.map((evt, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between border-b border-gray-50 last:border-0 hover:bg-violet-50/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-center p-2 min-w-[60px] bg-violet-50 border border-violet-100 rounded-lg">
                  <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">{new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                  <p className="text-sm font-bold text-violet-900">{new Date(evt.date).getDate()}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-900">{evt.title}</h4>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">{evt.category} · {evt.responsible}</p>
                </div>
              </div>
              <button onClick={() => onNavigate('events-calendar')} className="p-2 text-gray-300 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-all">
                <ChevronRight size={15} />
              </button>
            </div>
          ))}
          {!calendarEvents.length && <div className="px-6 py-8 text-center text-gray-400 text-xs italic">No upcoming events scheduled.</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Briefcase size={13} className="text-gray-400" /> Staffing Capacity
          </h3>
          <div className="h-44 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active Teachers', value: stats.activeTeachers || 0 },
                    { name: 'Deficit/Inactive', value: Math.max(0, stats.totalTeachers - stats.activeTeachers) || (stats.activeTeachers === 0 ? 1 : 0) },
                  ]}
                  cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                  <Cell fill={P.c2} />
                  <Cell fill={P.danger} />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} itemStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Teaching Staff</span>
                <span className="text-xs font-bold text-cyan-700">{stats.activeTeachers} / {stats.totalTeachers}</span>
              </div>
              <div className="w-full bg-white border border-gray-200 h-1 rounded-full overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${stats.totalTeachers ? (stats.activeTeachers / stats.totalTeachers) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Student Ratio</span>
                <span className="text-xs font-bold text-violet-700">1 : {Math.round(stats.totalStudents / (stats.totalTeachers || 1))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── School Calendar ──────────────────────────────────────────────────── */
  const renderSchoolCalendar = () => {
    const evtsByMonth = Object.entries(
      calendarEvents.reduce((acc, evt) => {
        const d = evt?.date ? new Date(evt.date) : null;
        if (d && !Number.isNaN(d.getTime())) {
          const m = d.toLocaleDateString('en-US', { month: 'short' });
          acc[m] = (acc[m] || 0) + 1;
        }
        return acc;
      }, {})
    ).map(([month, count]) => ({ month, count }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Upcoming Events" value={calendarEvents.length}       icon={Calendar}     subtitle="Scheduled activities" />
          <Card title="This Term"       value="Active"                       icon={CheckCircle}  subtitle="Current filter scope" />
          <Card title="Staff Count"     value={stats.totalTeachers}          icon={Users}        subtitle="Active educators" />
          <Card title="HR Actions"      value={visibleOperations.length}     icon={ChevronRight} subtitle="Linked workflows" />
        </div>

        <ChartPanel title="Monthly Event Distribution">
          <div className="h-52">
            {evtsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evtsByMonth} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                  <Area type="monotone" dataKey="count" stroke={P.c1} fill={P.c1} fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">No calendar trend data</div>
            )}
          </div>
        </ChartPanel>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50/40 to-white flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">School Calendar</h3>
            <button onClick={() => onNavigate('events-calendar')} className="px-3 py-1 bg-white border border-gray-200 rounded text-[10px] font-semibold uppercase hover:bg-gray-50 flex items-center gap-1">
              <Calendar size={11} /> Open Calendar
            </button>
          </div>
          {calendarEvents.map((evt, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between border-b border-gray-50 last:border-0 hover:bg-violet-50/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-center p-2 min-w-[60px] bg-violet-50 border border-violet-100 rounded-lg">
                  <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">{new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                  <p className="text-sm font-bold text-violet-900">{new Date(evt.date).getDate()}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-900">{evt.title}</h4>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">{evt.category} · {evt.responsible}</p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{new Date(evt.date).toLocaleDateString()}</span>
            </div>
          ))}
          {!calendarEvents.length && <div className="px-6 py-16 text-center text-gray-400 text-xs italic">No calendar events scheduled</div>}
        </div>
      </div>
    );
  };

  /* ── HR Overview ──────────────────────────────────────────────────────── */
  const renderHROverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Staff"  value={stats.totalTeachers}      icon={Briefcase} subtitle="All departments" />
        <Card title="Active Staff" value={stats.activeTeachers}     icon={UserCheck}  subtitle="Currently active" />
        <Card title="HR Actions"   value={visibleOperations.length} icon={Clock}      subtitle="Pending workflows" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChartPanel title="Staff Status">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active',   value: stats.activeTeachers || 0 },
                    { name: 'Inactive', value: Math.max(0, stats.totalTeachers - stats.activeTeachers) },
                  ]}
                  cx="50%" cy="50%" innerRadius={44} outerRadius={68} dataKey="value" paddingAngle={5} stroke="none">
                  <Cell fill={P.c2} />
                  <Cell fill={P.danger} />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} itemStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Learner Gender Profile">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Male', value: stats.males }, { name: 'Female', value: stats.females }]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                <Bar dataKey="value" name="Count" fill={P.c1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="HR Workload Snapshot">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{ name: 'Staff', value: stats.totalTeachers }, { name: 'Students', value: stats.totalStudents }, { name: 'HR Actions', value: visibleOperations.length }]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                <Area type="monotone" dataKey="value" stroke={P.c1} fill={P.c1} fillOpacity={0.14} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50/40 to-white">
          <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">HR Quick Links</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={() => onNavigate('teachers-list')} className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-xs font-semibold uppercase tracking-widest text-left hover:bg-violet-50 hover:border-violet-300 transition">Manage Staff Directory</button>
          <button onClick={() => onNavigate('settings-academic')} className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-xs font-semibold uppercase tracking-widest text-left hover:bg-violet-50 hover:border-violet-300 transition">Staff & Term Settings</button>
        </div>
      </div>
    </div>
  );

  /* ── AI Smart Insights ────────────────────────────────────────────────── */

  /* ── Un-Assessed slide-over ───────────────────────────────────────────── */
  const UnAssessedSheet = () => {
    const breakdown = metrics?.unAssessedBreakdown || [];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm">
        <div className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
          <div className="bg-white border-b border-violet-100 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-xl text-violet-700"><AlertCircle size={20} /></div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Un-Assessed Students</h2>
                <p className="text-xs text-slate-500 font-medium">Progress breakdown — {stats.currentTestSeries}</p>
              </div>
            </div>
            <button onClick={() => setShowUnAssessedSheet(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
              <X size={20} />
            </button>
          </div>
          <div className="bg-violet-50/50 px-6 py-4 border-b border-violet-100 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-violet-200 rounded-md shadow-sm">
              <Calendar size={13} className="text-violet-400" /><span className="text-xs font-bold text-violet-700">2026</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-violet-200 rounded-md shadow-sm">
              <Filter size={13} className="text-violet-400" /><span className="text-xs font-bold text-violet-700">TERM 2</span>
            </div>
            <div className="ml-auto">
              <div className="bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Live Sync</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {breakdown.length > 0 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total',       value: stats.totalStudents },
                    { label: 'Assessed',    value: stats.totalStudents - stats.totalMissedExams,  vColor: 'text-cyan-700',    bg: 'bg-cyan-50' },
                    { label: 'Progress',    value: `${Math.round(((stats.totalStudents - stats.totalMissedExams) / (stats.totalStudents || 1)) * 100)}%`, vColor: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Un-Assessed', value: stats.totalMissedExams,                        vColor: 'text-rose-600',    bg: 'bg-rose-50' },
                  ].map((c, idx) => (
                    <div key={idx} className={`${c.bg || 'bg-slate-50'} rounded-xl p-4 border border-gray-100`}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{c.label}</p>
                      <p className={`text-2xl font-semibold ${c.vColor || 'text-slate-900'}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-violet-50 border-b border-violet-100">
                      <tr>
                        {['Grade', 'Students', 'Done', 'Left', 'Status'].map(h => (
                          <th key={h} className="px-5 py-4 text-[10px] font-bold text-violet-800 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {breakdown.map((item, idx) => {
                        const pct = item.total > 0 ? Math.round((item.assessed / item.total) * 100) : 0;
                        return (
                          <tr key={idx} className="hover:bg-violet-50/30 transition-colors">
                            <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">{item.grade}</td>
                            <td className="px-5 py-3.5 text-sm text-center text-slate-600">{item.total}</td>
                            <td className="px-5 py-3.5 text-sm text-center text-cyan-600 font-bold">{item.assessed}</td>
                            <td className="px-5 py-3.5 text-sm text-center text-rose-500 font-bold">{item.unAssessed}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">{pct}%</span>
                                <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-cyan-500' : pct > 0 ? 'bg-violet-600' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mb-4">
                  <Activity className="text-violet-300" size={30} />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Synchronizing…</h3>
                <p className="text-sm text-slate-500 max-w-xs">Connecting to detailed assessment reports.</p>
              </div>
            )}
          </div>
          <div className="p-6 bg-violet-50 border-t border-violet-100">
            <button
              onClick={() => { setShowUnAssessedSheet(false); onNavigate('assess-summative-report'); }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-violet-700 text-white rounded-xl font-semibold hover:bg-violet-800 transition shadow-lg shadow-violet-700/20"
            >
              Open Detailed Summative Reports <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {refreshing && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2">
          <p className="text-[11px] font-bold text-violet-700 uppercase tracking-widest">Syncing Senior School analytics…</p>
        </div>
      )}

      {/* ── 1. Quick-action icon row ───────────────────────────────────────── */}
      <DashboardSection id="quick-actions" controls={sectionControls}>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 lg:gap-4 mb-2">
        {visibleShortcuts.map((sc, idx) => (
          <button
            key={idx}
            onClick={() => onNavigate(sc.path)}
            className="group flex flex-col items-center justify-start transition-all duration-300 active:scale-95"
          >
            <div className={`p-3.5 mb-2 rounded-full ${sc.color} shadow-md group-hover:shadow-lg group-hover:-translate-y-1 transition-transform duration-300 flex items-center justify-center`}>
              <sc.icon size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-violet-700 text-center leading-tight w-full truncate">
              {sc.label}
            </span>
          </button>
        ))}
      </div>
      </DashboardSection>

      {/* ── 2. Tab strip ───────────────────────────────────────────────────── */}
      <DashboardSection id="tab-navigation" controls={sectionControls}>
      <div className="flex items-center overflow-x-auto border-b border-gray-200 bg-white px-2 rounded-lg shadow-sm border border-gray-200">
        {[
          { id: 'overview',    label: 'Overview',    icon: Activity   },
          { id: 'financials',  label: 'Financials',  icon: Wallet     },
          { id: 'performance', label: 'Performance', icon: Award      },
          { id: 'operations',  label: 'Operations',  icon: Clock      },
          { id: 'calendar',    label: 'Calendar',    icon: Calendar   },
          { id: 'hr-overview', label: 'HR',          icon: Briefcase  },
        ].map(t => (
          <TabBtn key={t.id} label={t.label} icon={t.icon} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />
        ))}
      </div>
      </DashboardSection>

      {/* ── 3–5. Tab content ───────────────────────────────────────────────── */}
      <DashboardSection id="tab-content" controls={sectionControls}>
      <div className="animate-in slide-in-from-bottom-2 duration-300">
        {showUnAssessedSheet && <UnAssessedSheet />}
        {activeTab === 'overview'    && renderOverview()}
        {activeTab === 'financials'  && renderFinancials()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'operations'  && renderOperations()}
        {activeTab === 'calendar'    && renderSchoolCalendar()}
                {activeTab === 'hr-overview' && renderHROverview()}
      </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default SecondaryAdminDashboard;
